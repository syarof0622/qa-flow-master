<?php
/**
 * QA Flow Master Pro - Enterprise Security Video Upload Handler
 * Target Server: LiteSpeed / Apache / Nginx PHP Server
 */

// 1. CONFIGURATION & CONSTANTS
//
// The API key is resolved in this order so a real secret never has to live
// in a file that gets shared/versioned alongside this script:
//   1. QA_UPLOAD_API_KEY environment variable (set via cPanel "Environment
//      Variables" or an Apache `SetEnv QA_UPLOAD_API_KEY ...` in .htaccess)
//   2. qa-upload.secret.php sitting next to this file, containing only:
//        <?php return 'your-secret-here';
//      (requesting that file directly over HTTP returns a blank page,
//      since a bare top-level `return` produces no output - but keep it
//      out of any public repo/export regardless)
//   3. A fallback placeholder - uploads will be rejected until step 1 or 2
//      is configured, by design, so this file is never the only place the
//      real production secret exists.
function resolveApiSecret() {
    $envKey = getenv('QA_UPLOAD_API_KEY');
    if (is_string($envKey) && $envKey !== '') return $envKey;
    $secretFile = __DIR__ . '/qa-upload.secret.php';
    if (is_file($secretFile)) {
        $fromFile = include $secretFile;
        if (is_string($fromFile) && $fromFile !== '') return $fromFile;
    }
    error_log('qa-upload.php: no QA_UPLOAD_API_KEY env var or qa-upload.secret.php found - using placeholder key, uploads will be rejected.');
    return 'CHANGE_ME_' . 'PLACEHOLDER_NOT_A_REAL_SECRET';
}
define('API_SECRET_KEY', resolveApiSecret());
define('UPLOAD_DIR', __DIR__ . '/videos/');
define('MAX_VIDEO_AGE_SECONDS', 1800); // 30 minutes temporary file TTL
define('MAX_FILE_SIZE_BYTES', 52428800); // 50 MB max limit
define('RATE_LIMIT_DIR', __DIR__ . '/.ratelimit/');
define('RATE_LIMIT_MAX_REQUESTS', 10); // per IP, per window
define('RATE_LIMIT_WINDOW_SECONDS', 60);

// Ensure upload directory exists with strict permissions
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0755, true);
}

// Security Shield: Auto-generate .htaccess inside videos directory to prevent PHP/Script execution
$htaccess_path = UPLOAD_DIR . '.htaccess';
if (!file_exists($htaccess_path)) {
    $htaccess_rules = "# Security Protection: Disable PHP and executable script execution\n"
        . "<FilesMatch \"\\.(php|phtml|php3|php4|php5|phps|cgi|pl|py|jsp|asp|htm|html|exe|sh)$\">\n"
        . "    Order Deny,Allow\n"
        . "    Deny from all\n"
        . "</FilesMatch>\n"
        . "RemoveHandler .php .phtml .php3 .php4 .php5 .phps\n"
        . "RemoveType .php .phtml .php3 .php4 .php5 .phps\n"
        . "php_flag engine off\n";
    @file_put_contents($htaccess_path, $htaccess_rules);
}

// Protect the rate-limit bucket directory the same way as videos/
if (!is_dir(RATE_LIMIT_DIR)) {
    @mkdir(RATE_LIMIT_DIR, 0755, true);
}
$rl_htaccess_path = RATE_LIMIT_DIR . '.htaccess';
if (!file_exists($rl_htaccess_path)) {
    @file_put_contents($rl_htaccess_path, "Order Deny,Allow\nDeny from all\n");
}

/**
 * Simple file-locked per-IP fixed-window rate limiter. No database
 * required, safe for shared cPanel hosting. Fails open if the filesystem
 * is unavailable so a storage hiccup never blocks legitimate uploads.
 */
function isRateLimited($ip) {
    $safeKey = preg_replace('/[^a-zA-Z0-9_.:-]/', '_', $ip);
    if ($safeKey === '') $safeKey = 'unknown';
    $file = RATE_LIMIT_DIR . $safeKey . '.json';
    $fp = @fopen($file, 'c+');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $data = json_decode((string)$raw, true);
    $now = time();
    if (!is_array($data) || ($now - ($data['windowStart'] ?? 0)) > RATE_LIMIT_WINDOW_SECONDS) {
        $data = ['windowStart' => $now, 'count' => 0];
    }
    $data['count']++;
    $limited = $data['count'] > RATE_LIMIT_MAX_REQUESTS;
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $limited;
}

function detectRealVideoType($tmpPath) {
    $fh = @fopen($tmpPath, 'rb');
    if (!$fh) return null;
    $header = fread($fh, 12);
    fclose($fh);
    if ($header === false || strlen($header) < 4) return null;
    if (substr($header, 0, 4) === "\x1A\x45\xDF\xA3") return 'webm'; // EBML/Matroska magic
    if (strlen($header) >= 8 && substr($header, 4, 4) === 'ftyp') return 'mp4'; // ISO BMFF magic
    return null;
}

// Auto-cleanup: Purge temporary video files older than 30 minutes (1800s)
$files = glob(UPLOAD_DIR . '*');
$now = time();
if ($files) {
    foreach ($files as $file) {
        if (is_file($file) && basename($file) !== '.htaccess' && ($now - filemtime($file)) > MAX_VIDEO_AGE_SECONDS) {
            @unlink($file);
        }
    }
}

// 2. CORS & SECURITY HEADERS
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 3. RATE LIMITING (per client IP, before auth so brute-force/flood attempts
// are also throttled - not just successfully authenticated requests)
$client_ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (isRateLimited($client_ip)) {
    http_response_code(429);
    echo json_encode(["status" => "error", "message" => "Too many requests. Please slow down."]);
    exit;
}

// 4. SECURE AUTHENTICATION (Constant-Time String Comparison against Timing Attacks)
$provided_key = '';
if (isset($_SERVER['HTTP_X_API_KEY'])) {
    $provided_key = $_SERVER['HTTP_X_API_KEY'];
} elseif (function_exists('getallheaders')) {
    $headers = getallheaders();
    foreach ($headers as $k => $v) {
        if (strcasecmp($k, 'X-API-Key') === 0 || strcasecmp($k, 'x-api-key') === 0) {
            $provided_key = $v;
            break;
        }
    }
}
if (!$provided_key && isset($_POST['api_key'])) {
    $provided_key = $_POST['api_key'];
}

if (empty($provided_key) || !hash_equals(API_SECRET_KEY, (string)$provided_key)) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Unauthorized: Invalid API Key"]);
    exit;
}

// 5. SECURE UPLOAD HANDLING
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "No valid video file uploaded"]);
        exit;
    }

    $file = $_FILES['video'];

    // Security Check: Enforce File Size Limit (50MB)
    if ($file['size'] > MAX_FILE_SIZE_BYTES) {
        http_response_code(413);
        echo json_encode(["status" => "error", "message" => "File size exceeds 50MB limit"]);
        exit;
    }

    // Security Check: Verify actual file content (magic bytes), not just the
    // client-supplied filename extension, which is trivially forgeable.
    $ext = detectRealVideoType($file['tmp_name']);
    if ($ext === null) {
        http_response_code(415);
        echo json_encode(["status" => "error", "message" => "File is not a recognized webm/mp4 video"]);
        exit;
    }

    // Security Check: Cryptographically Random Filename (Prevents Directory Traversal & Overwrites)
    $random_id = function_exists('random_bytes') ? bin2hex(random_bytes(8)) : uniqid();
    $filename = 'qa_record_' . date('Ymd_His') . '_' . $random_id . '.' . $ext;
    $destination = UPLOAD_DIR . $filename;

    if (move_uploaded_file($file['tmp_name'], $destination)) {
        // Construct Public URL (Auto-detect HTTPS reliably across Proxy/Cloudflare/LiteSpeed)
        $is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
            || (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on')
            || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);
        $protocol = $is_https ? 'https' : 'http';
        $domain = $_SERVER['HTTP_HOST'];
        $path_to_script = dirname($_SERVER['REQUEST_URI']);
        if ($path_to_script === '/' || $path_to_script === '\\') $path_to_script = '';
        
        $public_url = $protocol . '://' . $domain . $path_to_script . '/videos/' . $filename;

        http_response_code(200);
        echo json_encode([
            "status" => "success", 
            "message" => "Video uploaded successfully",
            "url" => $public_url,
            "filename" => $filename,
            "ttl_seconds" => MAX_VIDEO_AGE_SECONDS
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Failed to move uploaded file to destination"]);
    }
} else {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
