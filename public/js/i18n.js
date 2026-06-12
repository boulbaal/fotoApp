// ── FotoApp i18n ──────────────────────────────────────────────────────────────
// Taalwisselaar voor de app-interface.
// Gebruik: window.i18n.t('key') of data-i18n="key" attribuut op HTML-elementen.

const APP_TRANSLATIONS = {
  nl: {
    // NAV
    nav_dashboard: "📊 Dashboard",
    nav_bronnen: "🗄️ Bronnen",
    nav_fotos: "🖼️ Foto's",
    nav_videos: "🎬 Video's",
    nav_duplicaten: "🔁 Duplicaten",
    nav_kaart: "🗺️ Kaart",
    nav_gps: "📍 GPS toewijzen",
    nav_negeren: "🚫 Negeren",
    nav_genegeerd: "📋 Genegeerd",
    nav_export: "📦 Export",
    nav_steun: "❤️ Steun dit project",
    nav_fase1: "Organiseren",
    nav_fase2: "Selecteren",
    nav_fase3: "Exporteren",
    // DASHBOARD
    stat_ready: "Klaar",
    stat_scanning: "Scannen...",
    // BUTTONS
    btn_scan: "Scan starten",
    btn_stop: "Stop scan",
    btn_add_source: "Bron toevoegen",
    btn_save: "Opslaan",
    btn_cancel: "Annuleren",
    btn_delete: "Verwijderen",
    btn_close: "Sluiten",
    btn_export: "Exporteren",
    btn_next: "Volgende",
    btn_prev: "Vorige",
    // LABELS
    lbl_total: "Totaal",
    lbl_unique: "Uniek",
    lbl_duplicate: "Dubbel",
    lbl_with_location: "Met locatie",
    lbl_without_location: "Zonder locatie",
    lbl_size: "Totale grootte",
    lbl_photos: "Foto's",
    lbl_videos: "Video's",
    lbl_year: "Jaar",
    lbl_camera: "Camera",
    lbl_country: "Landen",
    lbl_source: "Bron",
  },

  en: {
    nav_dashboard: "📊 Dashboard",
    nav_bronnen: "🗄️ Sources",
    nav_fotos: "🖼️ Photos",
    nav_videos: "🎬 Videos",
    nav_duplicaten: "🔁 Duplicates",
    nav_kaart: "🗺️ Map",
    nav_gps: "📍 Assign GPS",
    nav_negeren: "🚫 Ignore",
    nav_genegeerd: "📋 Ignored",
    nav_export: "📦 Export",
    nav_steun: "❤️ Support this project",
    nav_fase1: "Organize",
    nav_fase2: "Select",
    nav_fase3: "Export",
    stat_ready: "Ready",
    stat_scanning: "Scanning...",
    btn_scan: "Start scan",
    btn_stop: "Stop scan",
    btn_add_source: "Add source",
    btn_save: "Save",
    btn_cancel: "Cancel",
    btn_delete: "Delete",
    btn_close: "Close",
    btn_export: "Export",
    btn_next: "Next",
    btn_prev: "Previous",
    lbl_total: "Total",
    lbl_unique: "Unique",
    lbl_duplicate: "Duplicate",
    lbl_with_location: "With location",
    lbl_without_location: "Without location",
    lbl_size: "Total size",
    lbl_photos: "Photos",
    lbl_videos: "Videos",
    lbl_year: "Year",
    lbl_camera: "Camera",
    lbl_country: "Countries",
    lbl_source: "Source",
  },

  fr: {
    nav_dashboard: "📊 Tableau de bord",
    nav_bronnen: "🗄️ Sources",
    nav_fotos: "🖼️ Photos",
    nav_videos: "🎬 Vidéos",
    nav_duplicaten: "🔁 Doublons",
    nav_kaart: "🗺️ Carte",
    nav_gps: "📍 Assigner GPS",
    nav_negeren: "🚫 Ignorer",
    nav_genegeerd: "📋 Ignorés",
    nav_export: "📦 Exporter",
    nav_steun: "❤️ Soutenir ce projet",
    nav_fase1: "Organiser",
    nav_fase2: "Sélectionner",
    nav_fase3: "Exporter",
    stat_ready: "Prêt",
    stat_scanning: "Analyse...",
    btn_scan: "Démarrer l'analyse",
    btn_stop: "Arrêter l'analyse",
    btn_add_source: "Ajouter une source",
    btn_save: "Enregistrer",
    btn_cancel: "Annuler",
    btn_delete: "Supprimer",
    btn_close: "Fermer",
    btn_export: "Exporter",
    btn_next: "Suivant",
    btn_prev: "Précédent",
    lbl_total: "Total",
    lbl_unique: "Unique",
    lbl_duplicate: "Doublon",
    lbl_with_location: "Avec localisation",
    lbl_without_location: "Sans localisation",
    lbl_size: "Taille totale",
    lbl_photos: "Photos",
    lbl_videos: "Vidéos",
    lbl_year: "Année",
    lbl_camera: "Appareil",
    lbl_country: "Pays",
    lbl_source: "Source",
  },

  de: {
    nav_dashboard: "📊 Dashboard",
    nav_bronnen: "🗄️ Quellen",
    nav_fotos: "🖼️ Fotos",
    nav_videos: "🎬 Videos",
    nav_duplicaten: "🔁 Duplikate",
    nav_kaart: "🗺️ Karte",
    nav_gps: "📍 GPS zuweisen",
    nav_negeren: "🚫 Ignorieren",
    nav_genegeerd: "📋 Ignoriert",
    nav_export: "📦 Export",
    nav_steun: "❤️ Projekt unterstützen",
    nav_fase1: "Organisieren",
    nav_fase2: "Auswählen",
    nav_fase3: "Exportieren",
    stat_ready: "Bereit",
    stat_scanning: "Scanne...",
    btn_scan: "Scan starten",
    btn_stop: "Scan stoppen",
    btn_add_source: "Quelle hinzufügen",
    btn_save: "Speichern",
    btn_cancel: "Abbrechen",
    btn_delete: "Löschen",
    btn_close: "Schließen",
    btn_export: "Exportieren",
    btn_next: "Weiter",
    btn_prev: "Zurück",
    lbl_total: "Gesamt",
    lbl_unique: "Eindeutig",
    lbl_duplicate: "Duplikat",
    lbl_with_location: "Mit Standort",
    lbl_without_location: "Ohne Standort",
    lbl_size: "Gesamtgröße",
    lbl_photos: "Fotos",
    lbl_videos: "Videos",
    lbl_year: "Jahr",
    lbl_camera: "Kamera",
    lbl_country: "Länder",
    lbl_source: "Quelle",
  }
};

const FLAGS = { nl:"🇳🇱", en:"🇬🇧", fr:"🇫🇷", de:"🇩🇪" };
const LABELS = { nl:"NL", en:"EN", fr:"FR", de:"DE" };

window.i18n = (function() {
  let lang = localStorage.getItem("fotoapp_lang") || "nl";

  function t(key) {
    return (APP_TRANSLATIONS[lang] && APP_TRANSLATIONS[lang][key]) ||
           (APP_TRANSLATIONS.nl[key]) || key;
  }

  function applyAll() {
    document.documentElement.lang = lang;
    // Apply nav labels
    const navMap = {
      dashboard: t('nav_dashboard'),
      bronnen: t('nav_bronnen'),
      fotos: t('nav_fotos'),
      videos: t('nav_videos'),
      duplicaten: t('nav_duplicaten'),
      kaart: t('nav_kaart'),
      gpsbulk: t('nav_gps'),
      negeren: t('nav_negeren'),
      genegeerd: t('nav_genegeerd'),
      export: t('nav_export'),
    };
    document.querySelectorAll('[data-pagina]').forEach(btn => {
      const pagina = btn.dataset.pagina;
      if (navMap[pagina]) btn.textContent = navMap[pagina];
    });

    // Fase labels
    const fase1Labels = document.querySelectorAll('#stapFase1 .stap-label');
    const fase2Labels = document.querySelectorAll('#stapFase2 .stap-label');
    const fase3Labels = document.querySelectorAll('#stapFase3 .stap-label');
    fase1Labels.forEach(el => el.textContent = t('nav_fase1'));
    fase2Labels.forEach(el => el.textContent = t('nav_fase2'));
    fase3Labels.forEach(el => el.textContent = t('nav_fase3'));

    // Steun knop
    const steunBtn = document.querySelector('.doneer-sidebar-knop');
    if (steunBtn) steunBtn.textContent = t('nav_steun');

    // Scan indicator "Klaar"
    const indicator = document.getElementById('scanIndicator');
    if (indicator && !indicator.classList.contains('bezig')) {
      indicator.textContent = t('stat_ready');
    }

    // Update switcher UI
    const flagEl = document.getElementById('appLangFlag');
    const labelEl = document.getElementById('appLangLabel');
    if (flagEl) flagEl.textContent = FLAGS[lang];
    if (labelEl) labelEl.textContent = LABELS[lang];

    document.querySelectorAll('#appLangDropdown .lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    // Dispatch event so other modules can react
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function setLang(newLang) {
    if (!APP_TRANSLATIONS[newLang]) return;
    lang = newLang;
    localStorage.setItem("fotoapp_lang", lang);
    applyAll();
  }

  function getLang() { return lang; }

  return { t, setLang, getLang, applyAll };
})();

// ── DROPDOWN SETUP ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const switcher = document.getElementById('appLangSwitcher');
  const btn = document.getElementById('appLangBtn');
  if (!switcher || !btn) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    switcher.classList.toggle('open');
  });

  document.querySelectorAll('#appLangDropdown .lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      window.i18n.setLang(opt.dataset.lang);
      switcher.classList.remove('open');
    });
  });

  document.addEventListener('click', () => switcher.classList.remove('open'));

  // Apply on load
  window.i18n.applyAll();
});
