# Panduan UI-UX — QA Flow Master Pro

**Sistem Desain:** Bento UI (Minimalist & Clean Monochrome-Focused Architecture)
**Versi:** v3.0 · **Dasar kode:** `sidepanel.css` + `sidepanel.html` + `sidepanel.js`
**Penulis sistem desain:** Syarofuddin

---

## Daftar Isi

1. [Filosofi & Prinsip](#1-filosofi--prinsip)
2. [Design Tokens](#2-design-tokens)
3. [Palet Warna & Semantik](#3-palet-warna--semantik)
4. [Tipografi](#4-tipografi)
5. [Geometri: Radius, Spacing, Shadow](#5-geometri-radius-spacing-shadow)
6. [Sistem Layout Bento](#6-sistem-layout-bento)
7. [Komponen UI](#7-komponen-ui)
8. [Mode Gelap & Terang](#8-mode-gelap--terang)
9. [Responsivitas](#9-responsivitas)
10. [Motion & Animasi](#10-motion--animasi)
11. [Aksesibilitas (a11y)](#11-aksesibilitas-a11y)
12. [Panduan Penulisan Konten](#12-panduan-penulisan-konten)
13. [Checklist Do & Don't](#13-checklist-do--dont)
14. [Contoh Implementasi](#14-contoh-implementasi)
15. [Verifikasi Visual (Harness)](#15-verifikasi-visual-harness)

---

## 1. Filosofi & Prinsip

> **"Clean & Calm"** — antarmuka dirancang untuk *data-heavy QA workflow* agar mudah dipindai,
> tanpa distraksi. Prinsipnya: **monokrom dulu, aksen hanya untuk informasi penting.**

### 1.1 Prinsip inti

| Prinsip | Penerapan | Bukti di kode |
|---|---|---|
| **Monokrom-first** | Latar, kartu, teks didominasi skala abu/netral. Warna aksen hanya 1-2 per tampilan. | `--text-main/muted/dim`, `--bg-*` |
| **Bento Layout** | Konten disusun dalam blok/kartu geometris dengan radius konsisten, seperti grid bento Jepang. | `.bento-card`, `.bento-grid-*`, `.bento-metrics-grid` |
| **Hierarki visual** | Ukuran + ketebalan font (bukan warna) membentuk hierarki. | `13px/700` judul vs `9px/400` metadata |
| **Glassmorphism halus** | Kartu memakai `backdrop-filter: blur(12px)` + latar semi-transparan. | `.bento-card`, `.bento-copilot-card` |
| **Micro-interaction** | Setiap elemen interaktif punya umpan balik hover/focus ≤ 150–200ms. | `transition: all .15s ease` |
| **Konsisten token** | JANGAN hardcode warna/radius/font di komponen — selalu pakai CSS variable. | seluruh `:root` |

### 1.2 Cara berpikir "Bento"

Bento UI = **layout berbasis sel**. Satu layar dibagi menjadi sel-sel kisi yang bisa bergabung
(span) membentuk komposisi. Aturannya:

1. **Satu konten utama per kartu** — jangan menjejalkan dua tugas dalam satu bento.
2. **Kisi mengalir** — saat layar menyempit, sel menyusun ulang (1 → 2 → 3 kolom) tanpa patah.
3. **Fokus & skala** — kartu terpenting paling besar & paling kiri-atas (pola baca Z).
4. **Ruang putih itu desain** — jangan isi setiap piksel; biarkan gap bernapas.
5. **Satu aksen per bento** — kartu yang sedang aktif boleh menyala, sisanya tenang.

```
┌───────────────┬───────────────┬───────────────┐
│  A (hero/utama)│   B (metrik)  │   C (aksi)    │  ← grid 3 kolom
├───────────────┴───────────────┴───────────────┤
│            D (konten utama / scroll)          │  ← full-width
├───────────────┬───────────────┬───────────────┤
│      E        │      F        │      G        │  ← grid 3 kolom
└───────────────┴───────────────┴───────────────┘
```

### 1.3 Golden rules

- Satu layar = **maksimal 2 aksen warna** + skala monokrom.
- Setiap elemen interaktif = hover + focus + active + disabled (lihat §7.0).
- Setiap kartu: header jelas → konten → (opsional) aksi, dalam satu kolom.
- **Mobile-first**: rancang untuk 320px dulu, baru naik ke 480px.
- Radius & shadow konsisten agar bento terasa "satu keluarga".

---

## 2. Design Tokens

Semua token didefinisikan di `:root` (dark = default) dan dioverride oleh `body.light-theme` / `[data-theme="light"]`. **Token adalah satu-satunya sumber kebenaran** — jangan pernah menulis nilai langsung di komponen.

### 2.1 Mode Gelap (Default)

| Token | Nilai | Fungsi |
|---|---|---|
| `--bg-app` | `#0b0f19` | Latar aplikasi (app shell) |
| `--bg-card` | `rgba(18, 24, 38, 0.75)` | Latar kartu (glass) |
| `--bg-card-hover` | `rgba(28, 36, 56, 0.85)` | Kartu saat hover/aktif |
| `--bg-input` | `rgba(30, 41, 59, 0.5)` | Input, select, chip, list |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Border default |
| `--border-active` | `rgba(56, 189, 248, 0.4)` | Border saat fokus/aktif |
| `--border-danger` | `rgba(248, 113, 113, 0.55)` | Border state error |
| `--accent-primary` | `#38bdf8` | Aksi utama, link, ikon aktif |
| `--accent-success` | `#34d399` | Sukses / passed |
| `--accent-warning` | `#fbbf24` | Peringatan / running |
| `--accent-danger` | `#f87171` | Error / gagal / hapus |
| `--text-main` | `#f1f5f9` | Teks utama |
| `--text-muted` | `#94a3b8` | Teks sekunder / subtitel |
| `--text-dim` | `#94a3b8` | Label, metadata, hint |
| `--grad-card` | `linear-gradient(180deg, rgba(24,32,48,.5), rgba(15,21,33,.8))` | Gradient kartu |
| `--radius-bento` | `16px` | Kartu besar / modal |
| `--radius-inner` | `10px` | Elemen dalam kartu |
| `--radius-pill` | `9999px` | Badge, chip, tag |
| `--shadow-bento` | `0 4px 20px rgba(0,0,0,.25)` | Bayangan kartu |
| `--font-main` | `Inter, ui-sans-serif, system-ui, ...` | Font utama |
| `--font-mono` | `SFMono-Regular, Consolas, ...` | Font kode/log |

### 2.2 Mode Terang (Override)

| Token | Nilai |
|---|---|
| `--bg-app` | `#f8fafc` |
| `--bg-card` | `#ffffff` |
| `--bg-card-hover` | `#ffffff` |
| `--bg-input` | `#f1f5f9` |
| `--border-subtle` | `#cbd5e1` |
| `--border-active` | `#0284c7` |
| `--border-danger` | `#dc2626` |
| `--accent-primary` | `#075985` |
| `--accent-success` | `#059669` |
| `--accent-warning` | `#d97706` |
| `--accent-danger` | `#dc2626` |
| `--text-main` | `#0f172a` |
| `--text-muted` | `#475569` |
| `--text-dim` | `#334155` |
| `--grad-card` | `linear-gradient(180deg, #fff 0%, #f8fafc 100%)` |
| `--shadow-bento` | `0 4px 16px rgba(15,23,42,.08)` |

> ⚠️ **Aturan emas:** kontras teks vs latar harus memenuhi **WCAG AA** (≥ 4.5:1 untuk teks normal).
> Token di atas sudah dirancang memenuhi itu di kedua mode.

### 2.3 Skala elevasi (shadow)

| Level | Nilai | Dipakai oleh |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(15,23,42,.1)` | elemen terapung ringan, banner (lihat `--shadow-sm` di `.bento-banner`) |
| `--shadow-bento` | `0 4px 20px rgba(0,0,0,.25)` (dark) / `0 4px 16px rgba(15,23,42,.08)` (light) | kartu, panel |
| `--shadow-lg` | `0 20–25px 48px rgba(0,0,0,.4–.5)` | modal, workspace overlay |

> Gunakan shadow hanya untuk **mengangkat lapisan**, bukan untuk hiasan. Semakin dekat ke pengguna
> (modal > panel > kartu), semakin tinggi elevasinya.

### 2.4 Skala spacing (sistem 4px)

Selalu gunakan kelipatan 4px agar ritme visual konsisten.

| Token | Nilai | Contoh penggunaan |
|---|---|---|
| `--space-1` | `4px` | gap antar ikon kecil, padding mikro |
| `--space-2` | `8px` | padding input, gap tab, jarak antar kartu |
| `--space-3` | `12px` | padding kartu, body modal, padding header |
| `--space-4` | `16px` | padding modal besar, gap section utama |
| `--space-5` | `20px` | jarak antar section/group |
| `--space-6` | `24px` | jarak antar blok besar |

> Token ini adalah **rekomendasi**; gunakan nilai eksplisit 4px/8px/12px/16px bila belum ada variabel —
> yang penting konsisten mengikuti kelipatan 4px.

---

## 3. Palet Warna & Semantik

### 3.1 Warna Aksen (semantik)

| Warna | Dark | Light | Penggunaan |
|---|---|---|---|
| **Primary** (cyan/sky) | `#38bdf8` | `#075985` | Aksi utama, link, tab aktif, ikon brand, border fokus |
| **Success** (emerald) | `#34d399` | `#059669` | Test passed, status sehat, copied, ready |
| **Warning** (amber) | `#fbbf24` | `#d97706` | Running/paused, peringatan, menunggu |
| **Danger** (red) | `#f87171` | `#dc2626` | Test gagal, error, tombol hapus, recording |

### 3.2 Cara pakai aksen (aturan 10%)

- **Aksen = 1 fokus per layar.** Saat sebuah panel "sedang berjalan" (running), seluruh panel boleh pakai border aksen `color-mix(...)` — lihat `.bento-banner`.
- **Jangan gradien pelangi.** Sistem ini eksplisit melarang "rainbow gradients"; gunakan `--grad-card` atau `color-mix()` berbasis satu aksen.
- **Ikon semantik**: ikon kecil memakai aksen (mis. `#btnRunSuite svg` → success); teks tetap netral.

### 3.3 Neutral / monochrome

- Gelap: `#0b0f19` → `#1e293b` (latar), teks `#f1f5f9` / `#94a3b8`.
- Terang: `#f8fafc` → `#ffffff`, teks `#0f172a` / `#475569`.
- Gunakan `--text-main` untuk judul/nilai penting, `--text-muted` untuk body sekunder, `--text-dim` untuk label kecil/metadata.

---

## 4. Tipografi

`--font-main` (Inter/system) untuk seluruh UI, `--font-mono` untuk kode, nilai, log, dan data teknis.

### 4.1 Skala huruf

| Konteks | Ukuran | Berat | Line-height | Keterangan |
|---|---|---|---|---|
| Judul card (`h3`) | `12.5px` | `700` | `1.2` | `letter-spacing: -0.01em` |
| Judul modal | `13px` | `700` | `1.2` | ikon kotak 28px di kiri |
| Teks body utama | `12px` | `400–600` | `1.5` | pesan chat, deskripsi |
| Body default | `12.5px` | `400` | `1.5` | `body.bento-theme` |
| Teks sekunder | `10.5px` | `400` | `1.4` | `card-subtitle` |
| Label field | `8–9px` | `700–750` | `1.2` | `UPPERCASE`, `letter-spacing: .04–.05em` |
| Metadata / detail | `9px` | `400–600` | `1.3` | banner detail, metric label |
| Kode / nilai mono | `9.5–10px` | `600` | `1.25` | `--font-mono` |
| Nilai metrik besar | `14px` | `800` | `1` | `.metric-value` |

> **Aturan skala:** 8 → 9 → 10 → 11 → 12.5 → 14. Jangan melompat keluar dari skala ini.
> Judul > 14px hanya untuk layar lebar/header workspace (mis. `14px` pada `.qa-workspace-header h3`).

### 4.2 Aturan

- `line-height: 1.5` global; pesan chat `1.5`; banner teks `1.3`; nilai metrik `1` (tidak menggembung).
- Teks panjang wajib `word-break: break-word; overflow-wrap: anywhere` di item board.
- Jangan pernah kecilkan di bawah `8px` — tidak terbaca.
- **Uppercase + letter-spacing** hanya untuk label mikro (9px), bukan untuk kalimat.
- Saat label field di modal, gunakan `8px` saja (padat); di form workspace gunakan `9px`.

### 4.3 Tipografi responsif (fluida)

Untuk teks yang harus naik-turun di semua ukuran, gunakan `clamp()` agar tidak patah di tengah breakpoint:

```css
.hero-title {
  font-size: clamp(12.5px, 3.4vw, 16px); /* min 12.5 → ideal 3.4vw → max 16 */
  line-height: 1.2;
}
```

Gunakan `clamp()` **hanya** untuk judul; teks body & label tetap ukuran tetap agar konsisten dan kontras stabil.

---

## 5. Geometri: Radius, Spacing, Shadow

### 5.1 Radius

| Token | Nilai | Elemen |
|---|---|---|
| `--radius-bento` | `16px` | `.bento-card`, modal, tab container |
| `--radius-inner` | `10px` | tombol, input, chip, icon-btn, chat bubble |
| `--radius-pill` | `9999px` | badge, tag, copilot chip |

> Hierarki radius = hierarki visual: **kartu terbesar → elemen kecil paling tajam** (bukan sebaliknya).

### 5.2 Spacing (skala 4px)

Gunakan kelipatan 4px: **4 / 8 / 12 / 16 / 20 / 24** (lihat §2.4). Aturan pakai di dalam kartu:

| Jarak | Contoh penggunaan |
|---|---|
| `3–4px` | antar tombol aksi icon, gap chip |
| `6–8px` | gap grid `bento-grid-2/3`, jarak antar kartu, gap tab |
| `8px` | padding input (`8px 10px`), padding baris list |
| `10–12px` | padding kartu, body modal (`12px 16px`) |
| `16px` | padding modal besar, gap section utama |

**Ritme vertikal antar kartu:** konsisten `8px` (gap `.bento-app-wrapper`), jangan campur 6/8/10px
tanpa alasan. Bagian dalam kartu gunakan 8–12px; bagian antar grup gunakan 12–16px.

### 5.3 Shadow

Lihat skala elevasi di §2.3:
- Kartu: `--shadow-bento` (halus, kedalaman rendah).
- Modal/workspace: `--shadow-lg` — kedalaman tertinggi.
- Bubble chat system: `0 2px 8px rgba(0,0,0,0.1)`.

### 5.4 Kontainer responsif

Modal & panel memakai lebar persentase agar menyesuaikan semua ukuran:

| Komponen | Lebar | Catatan |
|---|---|---|
| `.bento-modal-card` (popup) | `max-width: 360px` + `width: 100%` | prompt/alert |
| `.export-modal-container` / `.ip-modal-container` | `max-width: 480px` + `width: 92%` | form lebar |
| `.annotator-modal-container` | `max-width: 720px` + `width: 95%` | canvas besar |
| `.qa-workspace` | `width: 100%` + `max-height: min(88vh, 680px)` | overlay penuh |

---

## 6. Sistem Layout Bento

### 6.1 Struktur dasar

```
body.bento-theme
└─ .bento-app-wrapper        (gap: 8px, kolom, scroll)
   ├─ .bento-header-card     (brand + logo + tindakan global)
   ├─ .bento-tabs            (navigasi tab, pill container)
   ├─ .tab-pane.active       (konten per tab — flex column, gap 8px)
   └─ .bento-footer          (status bar / informasi)
```

### 6.2 Grid utilitas

| Kelas | Kolom | Gap | Gunakan untuk |
|---|---|---|---|
| `.bento-grid-2` | 2 | 6px | pasangan aksi |
| `.bento-grid-3` | 3 | 6px | trio aksi/quick-actions |
| `.bento-metrics-grid` | 4 | 5px | ringkasan metrik |
| `.bento-preset-grid` | 2 | 5px | grid preset data (→ 1 kolom < 420px) |
| `.bento-history-list` | 1 | 4px | daftar riwayat |
| `.export-platforms` | 5 | 6px | picker platform (→ 3 kolom < 420px) |
| `.qa-form-grid` | 1 (→ 2 @ ≥480px) | 6–7px | form QA Workspace |

### 6.3 Resep grid Bento responsif (paling penting!)

**Jangan menulis ulang kolom per breakpoint.** Gunakan `auto-fit` + `minmax()` agar grid
otomatis menyusun ulang di semua ukuran tanpa satu pun media query:

```css
.bento-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  gap: 8px;
}

/* Membuat satu kartu jadi hero (span) di layar lebar */
.bento-tiles .tile-hero {
  grid-column: 1 / -1;
}

@media (min-width: 480px) {
  .bento-tiles .tile-hero { grid-column: span 2; }
}
```

- `min(100%, 140px)` mencegah overflow di panel tersempit.
- Gap konsisten `8px` (vertikal antar kartu) / `5–6px` (grid padat seperti metrik).
- Untuk panel *fixed* (tab bar, modal footer) gunakan `grid-template-columns: repeat(n, 1fr)` + media query —
  karena jumlah kolom memang disengaja tetap.

### 6.4 Strategi kolom per layar (panduan cepat)

| Jenis konten | ≤ 350px | ≤ 420px | ≥ 480px |
|---|---|---|---|
| Aksi/ikon | 1–2 kolom | 2 kolom | 2–3 kolom |
| Metrik angka | 2 kolom | 4 kolom | 4 kolom |
| Form | 1 kolom | 1 kolom | 2 kolom |
| Kartu konten | 1 kolom | 1–2 kolom | 2–3 kolom |
| Picker brand | 3 kolom | 3 kolom | 5 kolom |

### 6.5 Breakpoint grid (existing)

| Container / komponen | ≤ 350px | ≤ 420px | 421–479px | ≥ 480px |
|---|---|---|---|---|
| `bento-grid-2` | 1 kolom | 2 kolom | 2 kolom | 2 kolom |
| `bento-metrics-grid` | 2 kolom | 4 kolom | 4 kolom | 4 kolom |
| `export-platforms` | 3 kolom | 3 kolom | 5 kolom | 5 kolom |
| `qa-form-grid` | 1 | 1 | 1 | 2 kolom |
| `bento-preset-grid` / `data-context-grid` | 1 | 1 | 2 | 2 |

> ⚠️ **Kesalahan umum:** media query grid ditulis **sebelum** definisi utama → tidak efektif (lihat
> catatan perbaikan `.export-platforms` di memori repo). Selalu letakkan aturan responsif **setelah**
> definisi utama agar cascade benar.

---

## 7. Komponen UI

### 7.0 State komponen (wajib untuk semua elemen interaktif)

Setiap tombol, chip, tab, dan ikon harus mendefinisikan 5 state:

| State | Aturan | Contoh |
|---|---|---|
| **Default** | warna netral, border `--border-subtle` | `bg: var(--bg-input)` |
| **Hover** | naikkan kontras: border `--border-active`, teks `--text-main`, `translateY(-1px)` | `.bento-chip:hover` |
| **Focus** | `:focus-visible` outline 2px aksen (bukan cuma ganti border) | global rule §11.1 |
| **Active** | `.is-active` / `.active`: bg `--bg-card-hover` + border + `font-weight: 700` | `.bento-tab-btn.active` |
| **Disabled** | `opacity: .35` + `cursor: default`; jangan sembunyikan sepenuhnya | `.bento-secret-del:disabled` |

Aturan transisi: `transition: all .15s ease` (state) / `.2s` (kartu).

### 7.1 Kartu (`.bento-card`)

```css
.bento-card {
  background: var(--bg-card);
  background-image: var(--grad-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-bento);
  padding: 10px 12px;
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-bento);
  transition: border-color .2s, transform .2s;
}
```

- Hover: `border-color` naik (dark: `rgba(255,255,255,.12)`, light: `rgba(0,0,0,.15)`).
- **Wajib** `backdrop-filter` + `-webkit-` prefix untuk Safari.

### 7.2 Header (`.bento-header-card`)

- Logo 28×28px, radius inner, latar solid (`#101828`), ikon/teks kontras.
- Judul brand tebal; subtitle kecil `--text-muted`.
- Tindakan global di kanan (icon-btn 28×28).

### 7.3 Tab bar (`.bento-tabs` + `.bento-tab-btn`)

- Container pill: `background: var(--bg-input); padding: 3px; radius: var(--radius-bento); border: 1px solid var(--border-subtle)`.
- Tab: `min-height: 32px`, font `10px / 600`, radius inner, `white-space: nowrap`.
- **Aktif**: `background: var(--bg-card-hover); color: var(--text-main); font-weight: 700; border: 1px solid var(--border-subtle)`.
- Badge count (`--accent-danger`, pill, `9px`).
- ≤ 350px: font `9px`, ikon disembunyikan.

### 7.4 Tombol (`.bento-btn` + varian)

| Varian | Kelas | Style |
|---|---|---|
| **Primary** | `.bento-btn-primary` | Gradien `#0ea5e9→#0284c7`, teks putih, shadow aksen; hover brightness + `translateY(-1px)` |
| **Ghost** | `.bento-btn-ghost` | `--bg-card` + border subtle; hover border `--border-active` |
| **Outline** | `.bento-btn-outline` | `--bg-card` + border subtle; hover `--bg-card-hover` + border active |
| **Icon** | `.bento-icon-btn` | 28×28, radius inner; `.danger:hover` → merah |
| **Kecil** | `.bento-btn-sm` | untuk aksi inline |

- Base: `min-height: 34px; padding: 7px 12px; font-size: 10.5px; font-weight: 700; border-radius: var(--radius-inner)`.
- Aksi destruktif pakai ghost/outline + hover danger, bukan tombol merah penuh.

### 7.5 Input & Select

```css
.bento-input / .bento-select / .bento-textarea {
  background: var(--bg-input);
  border: 1px solid var(--border-subtle);
  color: var(--text-main);
  padding: 8px 10px;           /* input */
  border-radius: var(--radius-inner);
  font-size: 11px;
  outline: none;
  transition: all .2s;
}
.bento-input:focus { border-color: var(--border-active); box-shadow: 0 0 0 2px rgba(56,189,248,.2); }
```

- Select memakai chevron SVG data-uri kanan + `appearance: none`; `option` diberi latar solid (`#0f172a` dark / `#fff` light) agar dropdown terbaca.
- **Error state**: `.bento-modal-input-error` — latar `color-mix(danger 8%)`, border kiri `2px solid danger`, teks `9.5px`.
- **Focus ring**: gunakan `border-active` + `box-shadow 2px` aksen; **jangan hanya ubah warna border**.

### 7.6 Chip (`.bento-chip`, `.copilot-chip`, `.manual-requirement-chip`)

- `bento-chip`: kartu kecil kolom (ikon/label mono + teks deskriptif), min-height 44px; `.copied` → border success + bg success 12%.
- `copilot-chip`: pill, hover border primary + `translateY(-1px)`.
- `manual-requirement-chip`: pill kecil; `.is-selected` → primary.
- Chip/pill = **opsional**, pill = **status/tag**.

### 7.7 Metrik (`.bento-metric-card`)

- Kolom: label (`9px`, bold, uppercase, `--text-dim`) di atas nilai (`14px`, `800`, `--text-main`).
- Nilai berwarna aksen hanya jika semantik: `.text-success` / `.text-danger`.

### 7.8 Banner status (`.bento-banner`)

```
grid: [30px ikon] [1fr teks+detail] [auto kontrol]
```

- **State** via modifier kelas: `.is-running` (primary), `.is-passed` (success), `.is-failed` (danger), `.is-paused/.is-cancelled` (warning).
- Border aksen pakai `color-mix(in srgb, var(--accent) 42–46%, var(--border-subtle))` — bukan solid penuh.
- Ikon status: kotak 30×30 dengan latar `color-mix(accent 10%)`; ikon running berputar (`banner-spin`).
- Progress bar: strip 3px di bawah, warna mengikuti state.

### 7.9 Modal (`.bento-modal-overlay` / `.bento-modal-card` / `.bento-modal-container`)

- **Overlay**: `rgba(0,0,0,.65)` + `blur(8px)`, `z-index: 9999`; prompt modal `z-index: 99999` (selalu di atas).
- **Kartu**: `--bg-card` + `--grad-card`, border `--border-active`, radius bento, `max-width: 360px`, `scaleInModal` + `fadeInModal` (0.2s, `cubic-bezier(0.4,0,0.2,1)`).
- **Header**: judul tebal 13px + ikon kotak 28px (radius 8px, aksen) + tombol close.
- **Close**: 28×28, hover → `--accent-danger` bg + white icon.
- **Footer**: aksi rata kanan, gap 6px.
- **Varian lebar**: annotator `max-width: 720px`, posisi center-absolute.

### 7.10 Chat Copilot

- Area chat: `--bg-input` + border, radius inner, `max-width bubble 88%`.
- **System**: kiri, bubble `--bg-card` + border, `border-top-left-radius: 3px`, shadow halus.
- **User**: kanan, bubble aksen primary (gradien), teks putih.
- Masuk dengan `fadeInMsg` (0.2s, naik 6px).
- Saran prompt: pill `copilot-chip`.

### 7.11 Status kosong (`.bento-empty-state`)

Tampilkan ilustrasi/ikon netral + teks `--text-muted` + CTA opsional. Jangan pernah membiarkan area kosong tanpa state.

- Ikon: SVG `40–48px`, warna `--text-dim`.
- Teks: `11px`, `--text-muted`, maksimal 1–2 baris + subteks.
- CTA: `bento-btn bento-btn-outline` bila ada aksi yang masuk akal.

### 7.12 Toggle / Switch (opsional)

```css
.bento-switch { width: 34px; height: 20px; border-radius: var(--radius-pill); background: var(--bg-input); border: 1px solid var(--border-subtle); position: relative; cursor: pointer; transition: background .15s ease; }
.bento-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--text-muted); transition: transform .15s ease, background .15s ease; }
.bento-switch.is-on { background: color-mix(in srgb, var(--accent-success) 25%, var(--bg-input)); border-color: var(--accent-success); }
.bento-switch.is-on::after { transform: translateX(14px); background: var(--accent-success); }
```

- Sediakan `role="switch"` + `aria-checked`.
- Hanya untuk **biner & instan** (mis. auto-retry, dark mode). Untuk pilihan banyak → select/dropdown.

### 7.13 Notifikasi / Toast

- Muncul dari atas panel, `fixed`, `z-index` di atas modal (`100000`+), durasi tampil 2.5–4s.
- Kartu: `--bg-card` + border sesuai tipe (success/warning/danger) + ikon kotak 28px.
- Masuk/keluar: `translateY(-8px) → 0` + fade, 0.2s `cubic-bezier(0.16,1,0.3,1)`.
- Teks: `11px`, maks 1–2 baris; beri tombol tutup bila penting.

### 7.14 Loading / Skeleton

- Spinner: `.spin` / ikon SVG berputar `1.1s linear infinite` (warna `--accent-primary`).
- Skeleton bar: `background: color-mix(in srgb, var(--text-muted) 12%, transparent)`, radius inner,
  animasi pulse halus (opacity 0.5→1) — hindari shimmer yang berlebihan.
- Selalu tampilkan skeleton saat konten dimuat agar panel tidak "lompat".

### 7.15 Dropdown / Menu

- Tombol trigger: `bento-icon-btn` / `.qa-menu-trigger` (30×30).
- Menu: kartu terapung `--bg-card` + border + radius inner, `box-shadow` elevasi, `min-width: 180px`,
  `max-height: min(340px, calc(100vh - 140px))` + scroll.
- Item: grid `[16px ikon] [1fr teks]`, `min-height: 27px`, hover bg `--bg-input`; item berbahaya hover merah.
- Tutup saat klik luar / `Escape`.

---

## 8. Mode Gelap & Terang

### 8.1 Mekanisme

- **Default = gelap.** Token dark didefinisikan di `:root`.
- **Terang** diaktifkan salah satu dari:
  - `body.light-theme`, atau
  - `:root[data-theme="light"]` / `html[data-theme="light"]`.
- Semua warna melalui variable → **satu sumber kebenaran**, komponen otomatis mengikuti.

### 8.2 Aturan menulis komponen dua-mode

1. **Selalu pakai variable**, jangan hex hardcode di komponen.
2. Untuk komponen khusus yang butuh nilai berbeda, override di `body.light-theme .komponen` (contoh: `.copilot-chat-area`, `.copilot-chip`, `.bento-select option`).
3. Jangan duplikasi seluruh blok — hanya override properti yang berubah.
4. Uji kontras di kedua mode: teks di atas `--bg-input` di light = `#0f172a` di `#f1f5f9` ✅.
5. Shadow light lebih lembut (`rgba(15,23,42,.08)`) daripada dark (`.25`).

---

## 9. Responsivitas

**Konteks penting:** aplikasi berjalan di Side Panel VS Code → lebar sempit (~300–500px). Breakpoint media query = lebar viewport (sama dengan lebar panel). Desain dimulai **mobile-first (sempit)** lalu naik.

### 9.1 Prinsip mobile-first

1. Tulis **gaya dasar untuk panel tersempit** (1 kolom, kompak).
2. Naikkan kolom/ruang dengan `@media (min-width: ...)` — bukan mengecilkan dengan `max-width`.
3. Gunakan `auto-fit`/`minmax()` untuk grid yang mengalir otomatis (§6.3).
4. Hanya pakai media query eksplisit untuk komponen yang jumlah kolomnya memang disengaja.

### 9.2 Breakpoint & perilaku

| Breakpoint | Prinsip | Contoh |
|---|---|---|
| **< 350px** | Panel sangat sempit: 1 kolom, tab tanpa ikon, brand kecil, form 1 kolom | `bento-grid-2` → 1 kolom; tab font 9px |
| **350–419px** | Panel standar sempit: grid data 1 kolom, toolbar kompak, export platform 3 kolom | `bento-preset-grid` → 1 kolom |
| **420–479px** | Transisi: beberapa grid mulai 2 kolom | form masih 1 kolom |
| **≥ 480px** | Panel lebar: form 2 kolom, export platform 5 kolom | `qa-form-grid` → 2 kolom |

> Simpul penting: `420px` = batas bawah panel normal; `480px` = panel lebar.

### 9.3 Strategi per jenis elemen

| Elemen | Pendekatan |
|---|---|
| Grid konten | `repeat(auto-fit, minmax(min(100%, 140px), 1fr))` — mengalir otomatis |
| Grid aksi tetap | `repeat(2/3, 1fr)` + turun ke 1 kolom di `≤420px` |
| Metrik angka | `repeat(4, 1fr)`; turun `repeat(2,1fr)` di `≤350px` |
| Form | 1 kolom; naik 2 kolom di `≥480px`; field lebar pakai `.qa-field.wide` (`grid-column: 1/-1`) |
| Picker brand | `repeat(5,1fr)`; turun `repeat(3,1fr)` di `≤420px` |
| Modal | `width: 92–95%` + `max-width` per jenis (§5.4) |
| Tombol aksi form | full-width / stretch saat sempit (`.bento-full-width`) |

### 9.4 Checklist responsif

- [ ] Grid multi-kolom punya fallback 1 kolom di ≤ 420px.
- [ ] Tombol aksi form meluas penuh (`.bento-full-width` / stretch) saat sempit.
- [ ] Teks panjang di board/card pakai `word-break` — tidak ada overflow horizontal.
- [ ] Area scroll diberi `min-height: 0` + `overflow-y: auto` (flex child).
- [ ] Modal `width: 92–95%` + `max-width` per jenis; tidak pernah `width` tetap > 90%.
- [ ] Touch target minimal **28×28px** (icon-btn) — ideal 32–44px untuk tombol utama.
- [ ] Tidak ada `overflow-x` di body/modal (selalu cek `scrollWidth > clientWidth`).
- [ ] Media query responsif ditulis **setelah** definisi utama (cascade benar).
- [ ] Grid `auto-fit` memakai `min(100%, ...)` agar tidak overflow di 300px.
- [ ] Uji di 300 / 320 / 350 / 420 / 480 / 720px — bukan cuma 2 ukuran.

---

## 10. Motion & Animasi

### 10.1 Durasi & easing

| Motion | Durasi | Easing | Kapan |
|---|---|---|---|
| Hover/focus state | `150ms` | `ease` | tombol, chip, tab |
| Kartu border/transform | `200ms` | `ease` | `.bento-card` |
| Chip saran copilot | `180ms` | `cubic-bezier(0.16,1,0.3,1)` | naik 1px |
| Modal masuk | `200ms` | `cubic-bezier(0.4,0,0.2,1)` | `scaleInModal` + `fadeInModal` |
| Pesan chat masuk | `200ms` | `cubic-bezier(0.16,1,0.3,1)` | `fadeInMsg` (naik 6px) |
| Recording | `1–1.4s` loop | pulse/sweep | border + dot + sweep |

### 10.2 Aturan

- Durasi **< 250ms** untuk feedback; jangan pernah > 400ms untuk state biasa.
- Hanya animasi properti **transform & opacity** (performa, `will-change` tidak wajib untuk elemen kecil).
- Gunakan easing konsisten: `ease` untuk hover/focus, `cubic-bezier(0.4,0,0.2,1)` untuk modal,
  `cubic-bezier(0.16,1,0.3,1)` untuk item masuk (chat/chip).
- **Semua animasi wajib dimatikan** untuk `prefers-reduced-motion: reduce` — sudah ada blok global:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- Animasi *continuous* (spinner, pulse) harus punya `prefers-reduced-motion` fallback statis
  (ikon statis + teks status tetap terbaca).

---

## 11. Aksesibilitas (a11y)

### 11.1 Fokus

```css
button:focus-visible,
select:focus-visible,
input:focus-visible,
[role="button"]:focus-visible,
.file-label:focus-within {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

- Gunakan `:focus-visible` (jangan hilangkan outline saat keyboard nav).
- Jangan `outline: none` tanpa pengganti focus ring.

### 11.2 Kontras

| Kombinasi | Rasio (dark) | Rasio (light) |
|---|---|---|
| `--text-main` on `--bg-app` | ≥ 12:1 | ≥ 15:1 |
| `--text-muted` on `--bg-card` | ~7:1 | ~7:1 |
| Teks putih on primary gradient | ~4.5:1 | ✅ |

### 11.3 ARIA & semantik

- Radiogroup: `role="radiogroup"` + `role="radio"` + `aria-checked` (contoh `.export-platforms`).
- Tab: `role="tablist"` / `role="tab"` / `aria-selected`; panel `role="tabpanel"`.
- Modal: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (ke judul) + fokus trap (Esc menutup).
- Toggle: `role="switch"` + `aria-checked`.
- Ikon dekoratif: `aria-hidden="true"`; ikon informatif: `aria-label` + `title`.
- Tombol: label teks eksplisit atau `aria-label` — jangan hanya ikon.
- Status live (running/progress): gunakan `aria-live="polite"` pada elemen status.

### 11.4 Lainnya

- `sr-only` class tersedia untuk label tersembunyi.
- Scrollbar halus 4px (opsional dekoratif).
- Hindari teks miring/semua-kapital untuk kalimat panjang.
- Tombol disabled punya `opacity` + `cursor: default` (jangan `not-allowed` bila tombol memang inaktif sementara).
- Warna aksen **tidak boleh menjadi satu-satunya** indikator status — tambahkan ikon/teks (mis. banner punya ikon + label + progress).

---

## 12. Panduan Penulisan Konten

Bahasa UI: **Bahasa Indonesia** (konsisten). Istilah teknis tetap Inggris (suite, endpoint, webhook, deploy).

| Konteks | Gaya |
|---|---|
| Judul card/modal | Title Case atau kalimat singkat, tanpa titik akhir |
| Tombol | Verb: *Jalankan*, *Simpan*, *Kirim Laporan Bug*, *Batal* |
| Label field | Kapital di awal kata penting, jangan semua kapital |
| Hint / helper | 1 kalimat, akhiri titik, ≤ 60 karakter |
| Error | Kalimat aksi-able: "Tempel URL webhook Slack dari channel Anda." |
| Status | *Running, Passed, Failed, Paused, Cancelled* (konsisten) |
| Empty state | Jelaskan + beri langkah: "Belum ada data. Mulai dengan merekam suite." |

---

## 13. Checklist Do & Don't

### ✅ DO

- Pakai token CSS variable untuk **semua** warna/radius/shadow/font.
- Hierarki via ukuran/berat font dulu, warna aksen terakhir.
- Setiap elemen interaktif punya hover + `:focus-visible` + disabled state (§7.0).
- Komponen dua-mode diuji di dark **dan** light.
- Layout diuji di 300 / 320 / 350 / 420 / 480 / 720px.
- Modal berisi 1 tugas utama; aksi sekunder jadi ghost/outline.
- Ikon pakai SVG inline (selaras `currentColor`), ukuran 14–16px di dalam tombol, 15px di ikon kotak.
- Teks panjang pakai `word-break`/`overflow-wrap: anywhere`.
- `min-height: 0` pada child scrollable di dalam flex.
- Aksen status dipakai dengan `color-mix()` agar halus.
- Media query responsif ditulis **setelah** definisi utama.
- Grid konten pakai `auto-fit`/`minmax(min(100%, ...))`.
- Uji dengan harness visual (lihat §15) sebelum dianggap selesai.

### ❌ DON'T

- ❌ Hardcode hex di komponen (mis. `color: #38bdf8` di `.foo`).
- ❌ Gradien rainbow / banyak warna dalam satu kartu.
- ❌ Teks < 8px, atau kontras rendah (`--text-dim` di atas `--bg-app` untuk teks penting).
- ❌ Modal tanpa overlay blur / tanpa tombol tutup.
- ❌ `overflow-x` muncul; memaksa elemen lebih lebar dari panel.
- ❌ Animasi > 400ms atau berulang tanpa `prefers-reduced-motion`.
- ❌ Menghapus focus outline tanpa fallback.
- ❌ Tombol merah penuh untuk aksi non-destruktif.
- ❌ Menulis grid/lebar dalam `px` tetap yang tidak fleksibel (selalu persen + max-width).
- ❌ Status hanya dikodekan lewat warna tanpa ikon/teks pendukung.

---

## 14. Contoh Implementasi

### 14.1 Komponen baru (standar)

```html
<div class="bento-card">
  <div class="bento-card-header">
    <div class="card-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z"/>
      </svg>
      <h3>Kualitas Suite</h3>
    </div>
    <span class="badge-count">3</span>
  </div>
  <div class="bento-metrics-grid">
    <div class="bento-metric-card">
      <span class="metric-label">Passed</span>
      <span class="metric-value text-success">12</span>
    </div>
    <div class="bento-metric-card">
      <span class="metric-label">Failed</span>
      <span class="metric-value text-danger">2</span>
    </div>
  </div>
</div>
```

### 14.2 Tombol & form

```html
<form class="qa-form-grid">
  <div class="qa-field">
    <label>Nama Suite</label>
    <input class="bento-input" type="text" placeholder="smoke-checkout" />
  </div>
  <div class="qa-field wide">
    <label>Deskripsi</label>
    <textarea class="bento-textarea" rows="3"></textarea>
  </div>
</form>
<div class="bento-modal-footer">
  <button class="bento-btn bento-btn-ghost">Batal</button>
  <button class="bento-btn bento-btn-primary">Simpan</button>
</div>
```

### 14.3 Picker platform ber-brand (pola 1-Click Bug Exporter)

```html
<div class="export-platforms" role="radiogroup" aria-label="Platform Tujuan Bug Report">
  <button class="export-platform is-active" data-platform="slack"
          style="--brand:#E01E5A" role="radio" aria-checked="true">
    <svg .../> <span>Slack</span>
  </button>
  <!-- ... button lain: Teams #6264A7, GitHub currentColor, Linear #5E6AD2, Jira #0052CC -->
</div>
```

```css
.export-platform.is-active {
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 10%, transparent);
  box-shadow: 0 0 0 1px var(--brand);
}
```

### 14.4 Mengganti mode terang terprogram

```js
// Toggle
const isLight = document.body.classList.toggle('light-theme');
// atau
document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
```

### 14.5 Panel bento responsif lengkap (auto-fit)

Contoh komposisi bento yang menyesuaikan otomatis dari 300px → 720px tanpa media query untuk kolom:

```html
<section class="bento-dash" aria-label="Ringkasan">
  <article class="bento-card tile-hero">
    <div class="bento-card-header">
      <div class="card-title"><h3>Status Eksekusi</h3></div>
      <span class="badge-count">3</span>
    </div>
    <p class="card-subtitle">Hasil terbaru dari suite aktif.</p>
  </article>
  <article class="bento-card"><div class="bento-metrics-grid"><!-- 4 metrik --></div></article>
  <article class="bento-card"><!-- aksi cepat --></article>
  <article class="bento-card"><!-- riwayat --></article>
</section>
```

```css
.bento-dash {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
  gap: 8px;
}
.bento-dash .tile-hero {
  grid-column: 1 / -1;            /* full-width di semua ukuran */
}
@media (min-width: 480px) {
  .bento-dash .tile-hero { grid-column: span 2; }  /* hero 2 sel di panel lebar */
}
```

Hasil: 300px → 1 kolom; 420px → 2 kolom; 480px+ → hero 2 sel + lainnya mengalir. Tanpa satu pun
`max-width` grid, tanpa overflow, dan tetap mengikuti token bento.

---

## 15. Verifikasi Visual (Harness)

Setiap perubahan UI **wajib** diverifikasi visual sebelum dianggap selesai, agar tidak ada regresi
pada mode gelap/terang dan semua ukuran. Alur yang dipakai di proyek ini:

1. **Buat harness statis** — file `.tmp-*.html` yang memuat `sidepanel.css` + potongan HTML asli
   (menyalin komponen dari `sidepanel.html`, bukan menulis ulang). Overlay dimatikan
   (`position: static`) agar mudah dilihat.
2. **Buka di browser** dan buat screenshot di **mode gelap**.
3. **Toggle mode terang** (`body.light-theme` + `data-theme="light"`), screenshot lagi.
4. **Ukur layout** dengan skrip (Playwright `evaluate`):
   - `scrollWidth > clientWidth` → ada overflow horizontal ❌
   - jumlah kolom grid via `getComputedStyle(...).gridTemplateColumns`
   - warna border/bg aktif, kontras input di kedua mode
   - posisi chip/element (sejajar atau tidak)
5. **Uji viewport** 360px / 480px / 520px → pastikan grid menyusun ulang (mis. export platform 3→5 kolom).
6. **Bersihkan** file `.tmp-*.html` setelah selesai.

> Catatan penting dari pengalaman proyek: selalu periksa **urutan cascade** — media query yang ditulis
> sebelum definisi utama tidak akan berlaku (kasus `.export-platforms`). Dan jangan mengukur warna
> saat transisi 150ms belum selesai — tunggu ~250ms setelah toggle tema.

---

*Dokumen ini adalah sumber kebenaran (source of truth) untuk seluruh UI aplikasi.*
*Setiap perubahan komponen visual harus mengikuti token di atas — bukan nilai ad-hoc.*
