(() => {
  const idToEn = {
    'Ubah bahasa': 'Change language',
    'Ubah bahasa ke English': 'Switch language to English',
    'Ubah bahasa ke Bahasa Indonesia': 'Switch language to Indonesian',
    'Ganti Mode Terang/Gelap': 'Toggle light/dark mode',
    'Ganti mode terang atau gelap': 'Toggle light or dark mode',
    'Gunakan mode gelap': 'Use dark mode', 'Gunakan mode terang': 'Use light mode',
    'Buat Suite Baru': 'Create New Suite',
    'Duplikat Suite': 'Duplicate Suite',
    'Ubah nama suite aktif': 'Rename active suite',
    'Hapus Suite': 'Delete Suite',
    'Hapus suite aktif': 'Delete active suite',
    'Belum diperiksa': 'Not checked',
    'Info jaringan privat': 'Private network info',
    'Klik refresh untuk memeriksa': 'Click refresh to check',
    'Periksa informasi IP dan VPN melalui layanan eksternal': 'Check IP and VPN through an external service',
    'Langkah Tes': 'Test Steps',
    'Belum ada langkah tes.': 'No test steps yet.',
    'Klik "Rekam" atau tambah langkah manual.': 'Click "Record" or add a manual step.',
    'Pilih suite aktif': 'Select active suite',
    'lalu lakukan aksi di website, atau tambah langkah manual.': 'then interact with the website, or add a manual step.',
    'Rekam': 'Record', 'Jalankan': 'Run', 'Menjalankan tes': 'Running test', 'Menyiapkan suite…': 'Preparing suite…',
    'Jalan': 'Run', 'Layar': 'Screen', 'Merekam': 'Recording', 'Murni rekam video layar': 'Pure screen video recording', 'Rekam langkah tes': 'Record test steps', 'Jalankan tes': 'Run test',
    'Hentikan rekaman': 'Stop recording', 'Mulai rekaman': 'Start recording',
    'Sedang merekam · klik untuk berhenti': 'Recording · click to stop', 'Mulai merekam langkah tes': 'Start recording test steps',
    'Tambah Langkah Manual': 'Add Manual Step', '+ Manual Langkah Uji': '+ Manual Step',
    'Tipe Aksi:': 'Action Type:', 'Target CSS Selector:': 'CSS Target Selector:', 'Value / Expected Text:': 'Value / Expected Text:',
    'Notes (opsional):': 'Notes (optional):', 'Group:': 'Group:', 'Timeout:': 'Timeout:', 'Risk:': 'Risk:', 'Requirement ID:': 'Requirement ID:',
    'Simpan': 'Save', 'Batal': 'Cancel', 'Konfirmasi': 'Confirm', 'Ya, Lanjutkan': 'Yes, Continue',
    'Pesan konfirmasi...': 'Confirmation message...', 'Masukkan teks...': 'Enter text...',
    'Semua': 'All', 'Gagal': 'Failed', 'Pihak ketiga': 'Third-party', 'Tipe': 'Type', 'Status': 'Status', 'Domain': 'Domain',
    'Filter log': 'Log filters', 'Filter metode HTTP': 'HTTP method filters', 'Filter Network': 'Network filters',
    'Buka filter Network lanjutan': 'Open advanced Network filters', 'Filter lanjutan': 'Advanced filters',
    'Simpan body request/response (data sensitif)': 'Store request/response bodies (sensitive data)', 'Body capture aktif untuk sesi monitor berikutnya': 'Body capture enabled for the next monitor session', 'Body capture dimatikan': 'Body capture disabled',
    'Cari log': 'Search logs', 'Salin log yang tampil': 'Copy visible logs', 'Salin semua log yang tampil': 'Copy all visible logs',
    'Hapus semua log': 'Clear all logs', 'Memeriksa monitor': 'Checking monitor', 'Tes console monitor': 'Test console monitor',
    'Belum ada error terdeteksi.': 'No errors detected.',
    'Belum ada log terdeteksi.': 'No logs detected.',
    'Console errors, HTTP failures, dan API response body akan muncul di sini.': 'Console errors, HTTP failures, and API response bodies will appear here.',
    'Console.error, exceptions, HTTP 4xx/5xx, dan response body akan muncul di sini.': 'Console.error, exceptions, HTTP 4xx/5xx, and response bodies will appear here.',
    'Request lambat': 'Slow requests', 'Tampilkan request lambat': 'Show slow requests',
    'Internal': 'Internal', 'Pihak ketiga': 'Third-party',
    'QA Dummy Data Variables': 'QA Dummy Data Variables',
    'Klik chip untuk menyalin variabel. Pasang di value step tes.': 'Click a chip to copy the variable. Use it in a test step value.',
    'Tanpa dataset': 'No dataset', 'Nama Lengkap': 'Full Name', 'Email Acak': 'Random Email', 'No. HP Indonesia': 'Indonesian Phone',
    'Alamat Lengkap': 'Full Address', 'Nama Kota': 'City', 'Nama Perusahaan': 'Company', 'Jabatan': 'Job Title',
    'Password Kuat': 'Strong Password', 'Tgl Lampau': 'Past Date', 'Tgl Depan': 'Future Date', 'Harga IDR': 'IDR Price',
    'Teks Acak': 'Random Text', 'Waktu ISO': 'ISO Time',
    'Export & Report Suite': 'Export & Suite Report', 'Riwayat Eksekusi (Maks 20 Run)': 'Execution History (Max 20 Runs)',
    'Belum ada riwayat.': 'No history yet.', 'QA Readiness': 'QA Readiness',
    'Total': 'Total', 'Passed': 'Passed',
    'Hapus semua langkah': 'Delete all steps', 'Bersihkan state halaman': 'Clear page state', 'Audit aksesibilitas': 'Accessibility audit',
    'Delay antar langkah': 'Delay between steps', 'Jumlah retry': 'Retry count', 'Stop on error': 'Stop on error', 'Berhenti saat langkah gagal': 'Stop when a step fails',
    'Tutup': 'Close', 'Manager': 'Manager',
    'Nama suite': 'Suite name', 'Suite configuration': 'Suite configuration',
    'Nama suite wajib diisi.': 'Suite name is required.', 'Start URL harus menggunakan http:// atau https://.': 'Start URL must use http:// or https://.',
    'Tambah breakpoint': 'Add breakpoint', 'Hapus breakpoint': 'Remove breakpoint',
    'Eksekusi dijeda': 'Execution paused', 'Klik lanjutkan untuk meneruskan': 'Click resume to continue',
    'Buka riwayat versi suite': 'Open suite version history', 'Download backup workspace': 'Download workspace backup',
    'Suite versions': 'Suite versions', 'Restore & audit': 'Restore & audit', 'Belum ada versi.': 'No versions yet.',
    'Versi dibuat otomatis ketika suite berubah.': 'Versions are created automatically when the suite changes.',
    'Restore suite': 'Restore suite', 'Restore gagal': 'Restore failed', 'Backup dipulihkan': 'Backup restored',
    'Approve baseline': 'Approve baseline', 'Baseline gagal': 'Baseline failed',
    'Recorder terputus': 'Recorder disconnected', 'Recorder gagal': 'Recorder failed',
    'Pilihan sebelumnya dikoreksi otomatis': 'Previous choice corrected automatically', 'Toggle yang dibatalkan tidak direkam': 'Cancelled toggle was not recorded',
    'Resource': 'Resource', 'Live Connection': 'Live Connection', 'Network Request': 'Network Request',
    'Berhasil': 'Success', 'Perhatian': 'Attention', 'Gagal Menyalin': 'Copy Failed',
    'Muat ulang halaman target, lalu coba kembali.': 'Reload the target page, then try again.',
    'Muat ulang halaman target, lalu jalankan audit kembali.': 'Reload the target page, then run the audit again.',
    'Langkah': 'Steps', 'Data': 'Data', 'Log': 'Logs', 'Laporan': 'Report',
    'Klik Elemen': 'Click Element', 'Isi Input': 'Fill Input', 'Pilih Dropdown': 'Select Dropdown', 'Arahkan Kursor': 'Hover / Mouseover',
    'Pastikan Terlihat': 'Assert Visible', 'Pastikan Aktif': 'Assert Enabled', 'Pastikan Nonaktif': 'Assert Disabled',
    'Pastikan Tercentang': 'Assert Checked', 'Pastikan Tidak Tercentang': 'Assert Unchecked', 'Pastikan Teks': 'Assert Text',
    'Pastikan Nilai': 'Assert Value', 'Pastikan Atribut': 'Assert Attribute', 'Pastikan CSS': 'Assert CSS', 'Pastikan Jumlah': 'Assert Count',
    'Pastikan Screenshot': 'Assert Screenshot', 'Pastikan Status Network': 'Assert Network Status', 'Pastikan Tidak Ada Console Error': 'Assert No Console Error',
    'Pastikan Aksesibilitas': 'Assert Accessibility', 'Pastikan Batas Performa': 'Assert Performance Budget', 'Pastikan Header Keamanan': 'Assert Security Headers',
    'Request API + Assertion': 'API Request + Assert', 'Mock Route Network': 'Mock Network Route', 'Hapus Mock Network': 'Clear Network Mocks',
    'Jalankan Flow Reusable': 'Run Reusable Flow', 'Pastikan URL': 'Assert URL', 'Tunggu (Delay)': 'Wait (Delay)',
    'Tunggu Elemen Hilang': 'Wait for Element Hidden', 'Tunggu Teks Muncul': 'Wait for Text Appear', 'Tunggu URL Berubah': 'Wait for URL Change', 'Tunggu Network Idle': 'Wait for Network Idle',
    'Unduh Laporan HTML (+ Screenshot)': 'Download HTML Report (+ Screenshot)', 'Playwright TS': 'Playwright TS', 'Cypress Dasar': 'Cypress Basic',
    'Ekspor JSON': 'Export JSON', 'Impor JSON': 'Import JSON', 'Ekspor & Laporan Suite': 'Export & Report Suite',
    'Persyaratan': 'Requirements', 'Tambah defect': 'Add defect', 'Papan defect': 'Defect board', 'Sesi eksplorasi': 'Exploratory session',
    'Persetujuan rilis': 'Release sign-off', 'Riwayat versi': 'Version history', 'Backup workspace': 'Backup workspace',
    'Menu QA Readiness': 'QA Readiness menu', 'Buka menu QA Readiness': 'Open QA Readiness menu', 'Aksi QA Readiness': 'QA Readiness actions',
    'Halaman siap direkam': 'Page ready to record', 'Memeriksa halaman…': 'Checking page…', 'Halaman belum siap direkam': 'Page not ready to record',
    'Buka halaman HTTP atau HTTPS untuk merekam': 'Open an HTTP or HTTPS page to record', 'Halaman masih dimuat': 'Page is still loading',
    'Halaman belum siap': 'Page not ready', 'Tunggu halaman selesai dimuat atau muat ulang halaman target.': 'Wait for the page to finish loading or reload the target page.',
    'Recorder tidak dapat diaktifkan pada halaman ini.': 'Recorder cannot be activated on this page.', 'Tidak ada aksi valid yang direkam': 'No valid actions were recorded',
    'Review Rekaman': 'Recording Review', 'Smart Recorder': 'Smart Recorder', 'langkah': 'steps', 'Confidence': 'Confidence',
    '+ Assertion': '+ Assertion', 'Assertion ditambahkan': 'Assertion added', 'Selesai': 'Done', 'Validasi Replay': 'Validate Replay',
    'Memvalidasi…': 'Validating…', 'Replay Lulus': 'Replay Passed', 'Periksa Kegagalan': 'Inspect Failure',
    'Rekaman tervalidasi': 'Recording validated', 'Replay menemukan langkah gagal': 'Replay found a failed step',
    'Pastikan nilai tersimpan': 'Verify the value is retained', 'Pastikan tab terpilih': 'Verify the tab is selected',
    'Persyaratan': 'Requirements', 'Ketertelusuran': 'Traceability', '+ Persyaratan': '+ Requirement', 'Tanpa judul': 'Untitled',
    'Edit': 'Edit', 'Hapus': 'Delete', 'Belum ada requirement.': 'No requirements yet.',
    'Tambahkan requirement pertama untuk mulai mengukur coverage.': 'Add the first requirement to start measuring coverage.',
    'ID Persyaratan': 'Requirement ID', 'Requirement': 'Requirement', 'ID dan requirement wajib diisi.': 'ID and requirement are required.',
    'sudah tersedia.': 'already exists.', 'Requirement gagal disimpan.': 'Failed to save requirement.',
    'Riwayat Rekaman Video': 'Video Recording History',
    'Belum ada riwayat video.': 'No video history yet.',
    'Klik untuk memutar video': 'Click to play video',
    'Riwayat Rekaman': 'Recording History',
    'Berhasil diunggah!': 'Successfully uploaded!',
    'Disalin! ✅': 'Copied! ✅',
    'Salin Tautan': 'Copy Link',
    'Salin': 'Copy',
    'Cek / Edit Video Settings': 'Check / Edit Video Settings',
    'URL Upload belum dikonfigurasi': 'Upload URL is not configured',
    'Server tidak mengembalikan URL video. Cek konfigurasi PHP di cPanel Anda.': 'Server did not return a video URL. Check PHP config in cPanel.',
    'Upload gagal atau URL tidak dikonfigurasi.': 'Upload failed or URL is not configured.',
    'Gagal mengunggah video.': 'Failed to upload video.',
    'Rekaman video 0 byte. Pastikan izin rekam layar diberikan.': '0-byte video recording. Ensure screen recording permission is granted.',
    'Server PHP cPanel tidak mengembalikan URL video.': 'cPanel PHP Server did not return a video URL.',
    'Respons server cPanel bukan JSON valid.': 'cPanel server response is not valid JSON.',
    'Gagal menghubungi server CPanel. Cek koneksi / CORS / HTTPS.': 'Failed to contact cPanel server. Check connection / CORS / HTTPS.',
    'Koneksi ke server cPanel timeout (30 detik).': 'Connection to cPanel server timed out (30 seconds).',
    'Merekam layar saat langkah tes berjalan.': 'Record screen when test steps are running.',
    'Hapus Semua Riwayat': 'Clear All History',
    'Tautan Video:': 'Video Link:',
    'Pengaturan Server Video (cPanel)': 'Video Server Settings (cPanel)',
    'Video Settings': 'Video Settings',
    'Auto-record setiap tes berjalan': 'Auto-record every running test',
    'Endpoint Upload (PHP)': 'Upload Endpoint (PHP)',
    'API Key / Secret': 'API Key / Secret',
    'Memerlukan qa-upload.php di server': 'Requires qa-upload.php on server',
    'Tidak ada riwayat eksekusi.': 'No execution history.',
    'URL Tautan:': 'Link URL:',
    'Edit defect': 'Edit defect', 'Defect Baru': 'New defect', 'Siklus defect': 'Defect lifecycle', 'ID Defect': 'Defect ID',
    'Judul': 'Title', 'Keparahan': 'Severity', 'Penanggung jawab': 'Assignee', 'ID Requirements': 'Requirement IDs',
    'Title wajib diisi.': 'Title is required.', 'belum terdaftar.': 'is not registered.', 'Defect gagal disimpan.': 'Failed to save defect.',
    '+ Defect': '+ Defect', 'Belum ditugaskan': 'Unassigned', 'Tutup': 'Close', 'Tidak ada defect.': 'No defects.',
    'Quality gate tidak memiliki blocker aktif.': 'The quality gate has no active blockers.',
    'Tidak ada failure.': 'No failures.', 'Jalankan suite untuk menghasilkan diagnostic evidence.': 'Run the suite to generate diagnostic evidence.',
    'Pemeriksa Kegagalan': 'Failure inspector', 'Bukti Eksekusi': 'Execution evidence',
    'Base URL': 'Base URL', 'URL dasar environment:': 'Environment base URL:', 'Session Secrets': 'Rahasia Sesi',
    'Masukkan JSON. Data hanya tersimpan sampai extension/service worker berhenti.': 'Enter JSON. Data is only retained until the extension/service worker stops.',
    'Terapkan': 'Apply', 'Format harus object JSON.': 'Format must be a JSON object.', 'secret aktif untuk sesi ini': 'session secrets active',
    'Format Tidak Valid': 'Invalid Format', 'Dataset harus berisi array object.': 'Dataset must contain an array of objects.', 'Dataset Tidak Valid': 'Invalid Dataset',
    'Monitor aktif': 'Monitor active', 'Monitor gagal': 'Monitor failed', 'Menunggu halaman': 'Waiting for page',
    'Hentikan monitor': 'Stop monitor', 'Aktifkan dan tes monitor': 'Enable and test monitor', 'Monitor dihentikan': 'Monitor stopped',
    'Monitor tidak tersedia': 'Monitor unavailable', 'Buka halaman HTTP atau HTTPS terlebih dahulu.': 'Open an HTTP or HTTPS page first.', 'Monitor tidak dapat dipasang.': 'Monitor could not be installed.',
    'Suite Baru': 'New Suite', 'Masukkan nama untuk test suite baru:': 'Enter a name for the new test suite:', 'Buat Suite': 'Create Suite',
    'Rename Suite': 'Rename Suite', 'Masukkan nama baru untuk suite ini:': 'Enter a new name for this suite:', 'Simpan Nama': 'Save Name',
    'Suite Settings': 'Suite Settings', 'Owner': 'Owner', 'Priority': 'Priority', 'Tags': 'Tags', 'Release': 'Release',
    'Suite settings gagal disimpan.': 'Failed to save suite settings.', 'Suite settings tersimpan': 'Suite settings saved',
    'Hapus suite ini beserta seluruh langkah tes di dalamnya?': 'Delete this suite and all of its test steps?',
    'Buka tab website terlebih dahulu untuk mulai merekam.': 'Open a website tab before recording.', 'Buka tab website terlebih dahulu untuk menjalankan tes.': 'Open a website tab before running tests.',
    'Suite Kosong': 'Empty Suite', 'Belum ada langkah tes pada suite aktif ini.': 'The active suite has no test steps.',
    'Hapus Langkah Tes': 'Delete Test Steps', 'Hapus semua langkah tes pada suite aktif saat ini?': 'Delete all test steps in the active suite?', 'Hapus Semua': 'Delete All',
    'Charter wajib diisi.': 'Charter is required.', 'Session gagal disimpan.': 'Failed to save session.',
    'Release dan approver wajib diisi.': 'Release and approver are required.', 'Sign-off tersimpan': 'Sign-off saved',
    'Quality gate dan keputusan release tercatat.': 'Quality gate and release decision recorded.',
    'Riwayat versi': 'Version history', 'Revision': 'Revision', 'Restore': 'Restore', 'Revision tidak dapat dipulihkan.': 'Revision could not be restored.', 'Suite berhasil dipulihkan': 'Suite restored successfully',
    'Backup diblokir': 'Backup blocked', 'Data sensitif terdeteksi di': 'Sensitive data detected at',
    'Audit belum tersedia': 'Audit unavailable', 'Gagal menjalankan audit aksesibilitas pada halaman ini.': 'Failed to run the accessibility audit on this page.',
    'Clean State': 'Clean State', 'Bersihkan localStorage dan sessionStorage pada halaman web aktif?': 'Clear localStorage and sessionStorage on the active web page?',
    'Bersihkan Storage': 'Clear Storage', 'Clean State belum tersedia': 'Clean State unavailable', 'Storage halaman berhasil dibersihkan (Clean State)!': 'Page storage cleared successfully (Clean State)!',
    'Gagal membersihkan storage:': 'Failed to clear storage:', 'Tambah Langkah': 'Add Step', 'Edit Step': 'Edit Step', 'Tambah': 'Add',
    'Input Kurang': 'Missing Input', 'Target CSS Selector wajib diisi.': 'CSS target selector is required.',
    'Salin variabel': 'Copy variable', 'Gagal menyalin': 'Failed to copy', 'Browser tidak mengizinkan akses clipboard.': 'The browser denied clipboard access.',
    'Tidak ada log untuk disalin': 'No logs to copy', 'Proteksi Report': 'Report Protection', 'Password opsional. Kosongkan untuk HTML biasa.': 'Optional password. Leave blank for regular HTML.',
    'Download': 'Download', 'Menyiapkan report...': 'Preparing report...', 'Report Gagal': 'Report Failed', 'Report tidak dapat dibuat.': 'The report could not be created.',
    'Belum ada langkah tes untuk diexport.': 'No test steps to export.', 'Export Diblokir': 'Export Blocked', 'Gunakan {{session_secret}}.': 'Use {{session_secret}}.',
    'Restore gagal': 'Restore failed', 'Backup workspace tidak valid.': 'Workspace backup is invalid.', 'Import Berhasil': 'Import Successful',
    'dan konfigurasi suite dimuat.': 'and suite configuration loaded.', 'Import Gagal': 'Import Failed', 'Dokumen tidak dapat dimuat.': 'The document could not be loaded.',
    'Format Gagal': 'Invalid Format', 'Format JSON yang diimport tidak valid atau kosong.': 'The imported JSON format is invalid or empty.',
    'Gagal Membaca File': 'File Read Failed', 'Terjadi kesalahan saat membaca file JSON:': 'An error occurred while reading the JSON file:', 'File tidak dapat dibaca oleh browser.': 'The browser could not read the file.',
    'Catatan': 'Notes', 'Nilai Rekaman': 'Recorded Value', 'Statis': 'Static', 'Random Nama': 'Random Name', 'Random Alamat': 'Random Address',
    'Random Kota': 'Random City', 'Random Perusahaan': 'Random Company', 'Random Jabatan': 'Random Job Title', 'Random Harga': 'Random Price', 'Random Teks': 'Random Text',
    'Cari data': 'Search data', 'Cari pilihan data langkah': 'Search step data choices', 'Pilih data langkah': 'Select step data', 'Cari data…': 'Search data…',
    'Data tidak ditemukan': 'No data found', 'Aktifkan': 'Enable', 'Nonaktifkan': 'Disable', 'Jalankan · Shift: mulai dari sini': 'Run · Shift: start here',
    'tahan Shift untuk menjalankan dari langkah ini': 'hold Shift to run from this step', 'Duplikat langkah': 'Duplicate step', 'Hapus langkah': 'Delete step',
    'Salin sebagai cURL': 'Copy as cURL', 'Salin request sebagai cURL': 'Copy request as cURL', 'Salin pesan': 'Copy message', 'Salin pesan log': 'Copy log message',
    'Salin detail JSON': 'Copy JSON details', 'Salin detail lengkap log': 'Copy full log details', 'Pesan log disalin': 'Log message copied', 'Detail log disalin': 'Log details copied', 'cURL disalin': 'cURL copied',
    'Hapus Riwayat': 'Delete History', 'Hapus seluruh riwayat eksekusi tes?': 'Delete all test execution history?', 'Hapus Riwayat Ini': 'Delete This History',
    'Requirement belum dipetakan.': 'Requirements have not been mapped.', 'blocker harus ditutup atau diberi override.': 'blockers must be closed or overridden.',
    'Tidak ada suite aktif': 'No active suite', 'Minimal satu suite harus tetap tersedia': 'At least one suite must remain',
    'Tambahkan langkah tes terlebih dahulu': 'Add test steps first', 'Belum ada langkah untuk dihapus': 'No steps to delete', 'Belum ada langkah untuk diekspor': 'No steps to export',
    'Tidak ada suite untuk diekspor': 'No suite to export', 'Belum ada log untuk disalin': 'No logs to copy', 'Belum ada log untuk dihapus': 'No logs to delete',
    'Masukkan password untuk membuka report.': 'Enter the password to open the report.', 'Buka report': 'Open report', 'Password salah atau file rusak.': 'Incorrect password or corrupted file.'
    ,'Langkah uji': 'Step', 'Percobaan': 'attempt', 'Diharapkan': 'Expected', 'Aktual': 'Actual', 'Dicoba': 'Tried', 'Elemen yang diharapkan': 'Expected element',
    'Setujui baseline': 'Approve baseline', 'Kandidat baseline visual langkah': 'Visual baseline candidate step', 'Bukti kegagalan langkah': 'Failure evidence step',
    'Respons': 'Response', 'Permintaan': 'Request', 'Request Lambat': 'Slow Request', 'Koneksi Langsung': 'Live Connection',
    'Console Warning': 'Console Warning', 'Unhandled Exception': 'Unhandled Exception', 'Kesalahan Network': 'Network Error',
    'Total langkah': 'Total steps', 'Langkah lulus': 'Passed steps', 'Langkah gagal': 'Failed steps'
    ,'API URL harus menggunakan http atau https': 'API URL must use http or https', 'API request timeout': 'API request timed out',
    'Akses API ke private network diblokir': 'API access to private networks is blocked', 'Baseline candidate tidak valid.': 'Invalid baseline candidate.',
    'Dokumen suite tidak valid.': 'Invalid suite document.', 'Eksekusi lain masih berjalan. Hentikan atau tunggu sampai selesai.': 'Another execution is still running. Stop it or wait for it to finish.',
    'Tidak ada respons dari content script': 'No response from content script', 'Quality gate gagal. Isi overrideReason untuk pengecualian yang dapat diaudit.': 'Quality gate failed. Enter an override reason for an auditable exception.',
    'Recorder hanya dapat digunakan pada halaman HTTP atau HTTPS.': 'Recorder can only be used on HTTP or HTTPS pages.', 'Revision tidak ditemukan.': 'Revision not found.',
    'Screenshot tidak tersedia': 'Screenshot unavailable', 'Status API tidak sesuai': 'API status does not match', 'Tab target tidak tersedia.': 'Target tab is unavailable.',
    'Tidak ada eksekusi aktif.': 'No active execution.', 'Axe engine tidak tersedia': 'Axe engine is unavailable',
    'Elemen tidak dapat menerima fokus keyboard': 'Element cannot receive keyboard focus', 'Indikator fokus tidak terlihat': 'Focus indicator is not visible',
    'Elemen tidak ditemukan dalam': 'Element was not found within', 'Aksi tidak dikenali:': 'Unknown action:', 'Konfigurasi Axe tidak valid:': 'Invalid Axe configuration:',
    'Konfigurasi performa tidak valid:': 'Invalid performance configuration:', 'batas performa': 'performance budget', 'terlampaui': 'exceeded',
    'URL tidak berubah dalam': 'URL did not change within', 'masih:': 'still:', 'Elemen': 'Element', 'masih terlihat setelah': 'is still visible after',
    'tidak muncul di halaman': 'did not appear on the page', 'ada di DOM tapi tersembunyi': 'exists in the DOM but is hidden'
    ,'Halaman live siap · stream diabaikan saat menunggu': 'Live page ready · streams are ignored while waiting', 'DOM halaman belum tersedia': 'Page DOM is not available yet'
    ,'Riwayat Rekaman Video': 'Video Recording History'
    ,'Belum ada riwayat video.': 'No video history yet.'
    ,'Klik untuk memutar video': 'Click to play video'
    ,'Riwayat Rekaman': 'Recording History'
    ,'Berhasil diunggah!': 'Successfully uploaded!'
    ,'Mengunggah ke cPanel...': 'Uploading to cPanel...'
    ,'Rekaman Layar': 'Screen Record'
    ,'Disalin! ✅': 'Copied! ✅'
    ,'Salin Tautan': 'Copy Link'
    ,'Salin': 'Copy'
    ,'Cek / Edit Video Settings': 'Check / Edit Video Settings'
    ,'URL Upload belum dikonfigurasi': 'Upload URL is not configured'
    ,'Server tidak mengembalikan URL video. Cek konfigurasi PHP di cPanel Anda.': 'Server did not return a video URL. Check PHP config in cPanel.'
    ,'Upload gagal atau URL tidak dikonfigurasi.': 'Upload failed or URL is not configured.'
    ,'Gagal mengunggah video.': 'Failed to upload video.'
    ,'Rekaman video 0 byte. Pastikan izin rekam layar diberikan.': '0-byte video recording. Ensure screen recording permission is granted.'
    ,'Server PHP cPanel tidak mengembalikan URL video.': 'cPanel PHP Server did not return a video URL.'
    ,'Respons server cPanel bukan JSON valid.': 'cPanel server response is not valid JSON.'
    ,'Gagal menghubungi server cPanel. Cek koneksi / CORS / HTTPS.': 'Failed to contact cPanel server. Check connection / CORS / HTTPS.'
    ,'Koneksi ke server cPanel timeout (30 detik).': 'Connection to cPanel server timed out (30 seconds).'
    ,'Merekam layar saat langkah tes berjalan.': 'Record screen when test steps are running.'
    ,'Hapus Semua Riwayat': 'Clear All History'
    ,'Tautan Video:': 'Video Link:'
    ,'Pengaturan Server Video (cPanel)': 'Video Server Settings (cPanel)'
    ,'Video Settings': 'Video Settings',
    'Provider AI': 'AI Provider',
    'Model AI': 'AI Model',
    'Pilih versi model AI untuk mengontrol kecepatan & konsumsi token.': 'Choose AI model version to control speed & token consumption.',
    'API Key': 'API Key',
    'Masukkan API Key': 'Enter API Key',
    'Kunci ini disimpan secara lokal di browser Anda (chrome.storage).': 'This key is stored locally in your browser (chrome.storage).',
    'Simpan Pengaturan': 'Save Settings',
    'Save Pengaturan': 'Save Settings',
    'Pengaturan AI': 'AI Settings',
    'Pengaturan AI berhasil disimpan!': 'AI Settings saved successfully!',
    '⚡ DeepSeek V3 / Flash (Cepat & Hemat Token)': '⚡ DeepSeek V3 / Flash (Fast & Token Efficient)',
    'Sangat cepat dan hemat token API untuk pembuatan skenario biasa.': 'Ultra fast and token efficient API for standard scenario creation.',
    '🧠 DeepSeek R1 / Pro (Reasoning Mode)': '🧠 DeepSeek R1 / Pro (Reasoning Mode)',
    'Reasoning cerdas untuk analisis skenario kompleks.': 'Smart reasoning for complex scenario analysis.',
    '⚡ Gemini 2.0 Flash (Ultra Cepat & Hemat)': '⚡ Gemini 2.0 Flash (Ultra Fast & Efficient)',
    'Model paling cepat dan hemat token dari Google.': 'Fastest and most token-efficient model from Google.',
    '🎯 Gemini 1.5 Pro (Presisi & Context 1M)': '🎯 Gemini 1.5 Pro (Precision & 1M Context)',
    'Kapasitas konteks besar dan analisa mendalam.': 'Huge context capacity and deep analysis.',
    '⚡ Claude 3 Haiku (Ringan & Cepat)': '⚡ Claude 3 Haiku (Lightweight & Fast)',
    'Model paling cepat dan hemat dari Anthropic.': 'Fastest and most economical model from Anthropic.',
    '🎯 Claude 3.5 Sonnet (Pro Version)': '🎯 Claude 3.5 Sonnet (Pro Version)',
    'Performa tertinggi untuk coding & QA automation.': 'Highest performance for coding & QA automation.',
    'Tersimpan': 'Saved',
    'Riwayat Chat': 'Chat History',
    'Chat Baru': 'New Chat',
    'Buat Percakapan Chat Baru': 'Create New Chat Session',
    'Hapus Percakapan Aktif': 'Delete Active Chat Session',
    'Langkah tes berhasil di-generate:': 'Test steps successfully generated:',
    'AI berhasil membuat skenario uji untuk halaman ini:': 'AI successfully created a test scenario for this page:',
    'Langkah Tes Di-generate:': 'Test Steps Generated:',
    'Tambahkan ke Suite': 'Add to Suite',
    'Jalankan Tes (Live)': 'Run Test (Live)',
    'Ditambahkan': 'Added',
    'Menjalankan...': 'Running...',
    'Memulai pengujian live': 'Starting live test',
    'pada tab aktif...': 'on active tab...'
  };
  const enToId = Object.fromEntries(Object.entries(idToEn).map(([id, en]) => [en, id]));
  let language = 'id';
  let observer;

  function translate(value, target = language) {
    if (!value || target === 'id' && !Object.keys(enToId).some(key => value.includes(key)) || target === 'en' && !Object.keys(idToEn).some(key => value.includes(key))) return value;
    const dictionary = target === 'en' ? idToEn : enToId;
    const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Object.keys(dictionary).sort((a, b) => b.length - a.length).reduce((text, key) => {
      const left = /^[A-Za-z0-9_]/.test(key) ? '\\b' : '';
      const right = /[A-Za-z0-9_]$/.test(key) ? '\\b' : '';
      return text.replace(new RegExp(`${left}${escapeRegExp(key)}${right}`, 'g'), dictionary[key]);
    }, value);
  }

  function translateNode(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.parentElement?.closest('script, style, code, pre, [data-no-i18n]')) return;
      const next = translate(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [...document.querySelectorAll('*')];
    elements.forEach(element => ['title', 'aria-label', 'placeholder'].forEach(attribute => {
      const value = element.getAttribute?.(attribute);
      const next = translate(value);
      if (value && next !== value) element.setAttribute(attribute, next);
    }));
  }

  function updateControl() {
    const button = document.getElementById('btnLanguageToggle');
    if (button) {
      const label = language === 'id' ? 'Ubah bahasa ke English' : 'Switch language to Indonesian';
      button.setAttribute('aria-label', label);
      button.title = language === 'id' ? 'Ubah bahasa' : 'Change language';
    }
    document.documentElement.lang = language;
  }

  function setLanguage(next, persist = true) {
    language = next === 'en' ? 'en' : 'id';
    translateNode();
    updateControl();
    if (persist) chrome.storage.local.set({ uiLanguage: language });
  }

  document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['uiLanguage'], result => setLanguage(result.uiLanguage || 'id', false));
    document.getElementById('btnLanguageToggle')?.addEventListener('click', () => setLanguage(language === 'id' ? 'en' : 'id'));
    let timeout;
    observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => translateNode(document.body), 100);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  window.QAI18n = { t: translate, setLanguage, getLanguage: () => language, locale: () => language === 'en' ? 'en-US' : 'id-ID', dictionary: Object.freeze({ ...idToEn }) };
})();
