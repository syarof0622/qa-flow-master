/**
 * QADataGenerator - Enterprise Grade QA Dummy Data & Faker Utility
 * Designed for QA Flow Master Pro Chrome Extension
 */

const QADataGenerator = {
  firstNames: ['Budi', 'Siti', 'Andi', 'Dewi', 'Rian', 'Maya', 'Eko', 'Rina', 'Reza', 'Nadia', 'Bambang', 'Fitri', 'Fajar', 'Anita', 'Bagas', 'Rizky', 'Tari', 'Ayu', 'Rangga', 'Mega'],
  lastNames: ['Santoso', 'Wijaya', 'Nugroho', 'Pratama', 'Lestari', 'Kusuma', 'Putra', 'Hidayat', 'Wibowo', 'Siregar', 'Subagyo', 'Saputra', 'Sari', 'Utami', 'Simanjuntak'],
  cities: ['Jakarta Selatan', 'Bandung', 'Surabaya', 'Yogyakarta', 'Semarang', 'Medan', 'Denpasar', 'Bekasi', 'Tangerang', 'Makassar', 'Palembang', 'Malang'],
  streets: ['Jl. Jend. Sudirman No. ', 'Jl. MH Thamrin No. ', 'Jl. Gatot Subroto No. ', 'Jl. Asia Afrika No. ', 'Jl. Rasuna Said No. ', 'Jl. Merdeka No. ', 'Jl. Diponegoro No. '],
  companies: ['PT Tech Inovasi QA', 'PT Digital Nusantara', 'PT Solusi Data QA', 'CV Karya Maju Tes', 'PT Cloud Sistem Indonesia', 'PT Maju Bersama', 'CV Tunas Bangsa'],
  jobTitles: ['QA Engineer', 'Software Developer', 'Product Manager', 'Data Analyst', 'DevOps Engineer', 'UI/UX Designer', 'System Administrator', 'Marketing Manager'],
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  ],

  getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  getEmail() {
    const timestamp = Date.now().toString(36);
    const rand = Math.floor(Math.random() * 1000);
    return `qa.tester.${timestamp}${rand}@testdomain.com`;
  },

  getFullName() {
    return `${this.getRandomElement(this.firstNames)} ${this.getRandomElement(this.lastNames)}`;
  },

  getPhone() {
    const prefix = ['0812', '0813', '0856', '0878', '0811', '0821', '0896', '0838'];
    return `${this.getRandomElement(prefix)}${this.getRandomInt(10000000, 99999999)}`;
  },

  getAddress() {
    return `${this.getRandomElement(this.streets)}${this.getRandomInt(1, 150)}, ${this.getRandomElement(this.cities)}`;
  },

  getCity() {
    return this.getRandomElement(this.cities);
  },

  getCompany() {
    return this.getRandomElement(this.companies);
  },

  getJobTitle() {
    return this.getRandomElement(this.jobTitles);
  },

  getNPWP() {
    // Format NPWP Indonesia: 00.000.000.0-000.000
    const p1 = String(this.getRandomInt(10, 99));
    const p2 = String(this.getRandomInt(100, 999));
    const p3 = String(this.getRandomInt(100, 999));
    const p4 = String(this.getRandomInt(1, 9));
    const p5 = String(this.getRandomInt(100, 999));
    return `${p1}.${p2}.${p3}.${p4}-${p5}.000`;
  },

  getNIK() {
    // NIK Indonesia: 16 digits
    const prov = this.getRandomInt(11, 94);
    const kab = this.getRandomInt(1, 99).toString().padStart(2, '0');
    const kec = this.getRandomInt(1, 99).toString().padStart(2, '0');
    let tgl = this.getRandomInt(1, 31);
    const isFemale = Math.random() > 0.5;
    if (isFemale) tgl += 40;
    const bln = this.getRandomInt(1, 12).toString().padStart(2, '0');
    const thn = this.getRandomInt(70, 99).toString().padStart(2, '0');
    const urut = this.getRandomInt(1, 9999).toString().padStart(4, '0');
    return `${prov}${kab}${kec}${tgl.toString().padStart(2, '0')}${bln}${thn}${urut}`;
  },

  getPassword() {
    const specials = ['!', '@', '#', '$', '%', '&', '*'];
    const spec = this.getRandomElement(specials);
    const num = this.getRandomInt(100, 999);
    return `QaTestPass${spec}${num}`;
  },

  getCreditCard(type = 'visa') {
    if (type === 'mastercard') return `5132${this.getRandomInt(1000, 9999)}${this.getRandomInt(1000, 9999)}${this.getRandomInt(1000, 9999)}`;
    if (type === 'amex') return `37${this.getRandomInt(10, 99)}${this.getRandomInt(100000, 999999)}${this.getRandomInt(10000, 99999)}`;
    // default visa
    return `4532${this.getRandomInt(1000, 9999)}${this.getRandomInt(1000, 9999)}${this.getRandomInt(1000, 9999)}`;
  },

  getPostcode() {
    return String(this.getRandomInt(10110, 60290));
  },

  getUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  getIPAddress(v6 = false) {
    if (v6) {
      return Array.from({length: 8}, () => Math.floor(Math.random() * 65535).toString(16)).join(':');
    }
    return `${this.getRandomInt(1, 255)}.${this.getRandomInt(0, 255)}.${this.getRandomInt(0, 255)}.${this.getRandomInt(1, 255)}`;
  },

  getMacAddress() {
    return Array.from({length: 6}, () => Math.floor(Math.random() * 255).toString(16).padStart(2, '0')).join(':');
  },

  getURL() {
    const protocols = ['http', 'https'];
    const domains = ['example.com', 'test.co.id', 'dummy-web.net', 'qa-staging.org'];
    return `${this.getRandomElement(protocols)}://${this.getRandomElement(domains)}/path_${this.getRandomInt(1, 100)}`;
  },

  getCurrencyIDR() {
    return this.getRandomInt(10, 10000) * 1000;
  },

  getDate(type = 'past') {
    const today = new Date();
    if (type === 'past') {
      today.setDate(today.getDate() - this.getRandomInt(1, 3650));
    } else if (type === 'future') {
      today.setDate(today.getDate() + this.getRandomInt(1, 3650));
    }
    return today.toISOString().split('T')[0];
  },

  getLoremIpsum() {
    return "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";
  },

  getRandomText(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  getUserAgent() {
    return this.getRandomElement(this.userAgents);
  },

  /**
   * Dynamic Variable Interpolator Engine
   * Replaces tags like {{email}}, {{fullname}}, {{password}}, {{npwp}} with generated dummy data
   */
  interpolate(template) {
    if (typeof template !== 'string') return template;
    
    // Evaluate math expressions in template if needed (e.g. {{random_int}})
    return template
      .replace(/\{\{email\}\}/gi, () => this.getEmail())
      .replace(/\{\{fullname\}\}/gi, () => this.getFullName())
      .replace(/\{\{phone\}\}/gi, () => this.getPhone())
      .replace(/\{\{address\}\}/gi, () => this.getAddress())
      .replace(/\{\{city\}\}/gi, () => this.getCity())
      .replace(/\{\{company\}\}/gi, () => this.getCompany())
      .replace(/\{\{job_title\}\}/gi, () => this.getJobTitle())
      .replace(/\{\{npwp\}\}/gi, () => this.getNPWP())
      .replace(/\{\{nik\}\}/gi, () => this.getNIK())
      .replace(/\{\{password\}\}/gi, () => this.getPassword())
      .replace(/\{\{cc_visa\}\}/gi, () => this.getCreditCard('visa'))
      .replace(/\{\{cc_master\}\}/gi, () => this.getCreditCard('mastercard'))
      .replace(/\{\{cc_amex\}\}/gi, () => this.getCreditCard('amex'))
      .replace(/\{\{postcode\}\}/gi, () => this.getPostcode())
      .replace(/\{\{uuid\}\}/gi, () => this.getUUID())
      .replace(/\{\{ip_v4\}\}/gi, () => this.getIPAddress(false))
      .replace(/\{\{ip_v6\}\}/gi, () => this.getIPAddress(true))
      .replace(/\{\{mac_address\}\}/gi, () => this.getMacAddress())
      .replace(/\{\{url\}\}/gi, () => this.getURL())
      .replace(/\{\{price_idr\}\}/gi, () => this.getCurrencyIDR())
      .replace(/\{\{date_past\}\}/gi, () => this.getDate('past'))
      .replace(/\{\{date_future\}\}/gi, () => this.getDate('future'))
      .replace(/\{\{lorem_ipsum\}\}/gi, () => this.getLoremIpsum())
      .replace(/\{\{user_agent\}\}/gi, () => this.getUserAgent())
      .replace(/\{\{randomtext\}\}/gi, () => this.getRandomText(8))
      .replace(/\{\{timestamp\}\}/gi, () => new Date().toISOString());
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QADataGenerator;
}
