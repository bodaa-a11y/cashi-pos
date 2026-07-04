/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  appId: "com.cashi.pos",
  productName: "كاشي",
  copyright: "Copyright © 2026 Cashi POS",
  
  directories: {
    output: "release",
    buildResources: "assets"
  },

  files: [
    "dist/**/*",
    "dist-electron/**/*",
    "public/**/*",
    "assets/**/*",
    "!src",
    "!electron",
    "!.env*"
  ],

  // تضمين ملفات إضافية خارج asar
  extraResources: [
    {
      from: "public/manager",
      to: "manager",
      filter: ["**/*"]
    }
  ],

  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ],
    icon: "assets/icon.png",
    artifactName: "Cashi-Setup-${version}.${ext}"
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "كاشي"
  },

  // ضغط بصيغة asar
  asar: true,
  compression: "maximum"
};

export default config;
