// ── FotoApp i18n ──────────────────────────────────────────────────────────────
// Gebruik: window.i18n.t('key') of data-i18n="key" attribuut op HTML-elementen.
// data-i18n-placeholder="key" voor input placeholders.
// data-i18n-html="key" voor innerHTML (met HTML-tags in de vertaling).

const APP_TRANSLATIONS = {
  nl: {
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
    dash_fotos_label: "📷 Foto's",
    dash_videos_label: "🎬 Video's",
    lbl_total: "Totaal",
    lbl_unique: "Uniek",
    lbl_duplicate: "Dubbel",
    lbl_with_location: "Met locatie",
    lbl_without_location: "Zonder locatie",
    lbl_total_size: "Totale grootte",
    grafiek_fotos_jaar: "📅 Foto's per jaar",
    grafiek_videos_jaar: "🎬 Video's per jaar",
    grafiek_cameras_fotos: "📷 Camera's (foto's)",
    grafiek_cameras_videos: "🎬 Camera's (video's)",
    grafiek_landen_fotos: "🌍 Landen (foto's)",
    grafiek_landen_videos: "🌍 Landen (video's)",
    grafiek_per_bron: "💾 Per bron",
    fase1_checklist: "📋 Checklist fase 1",
    fase1_afronden: "Fase 1 afronden → Fase 2",
    manifest_titel: "📷 Jouw foto's. Jouw computer. Jouw controle.",
    manifest_tekst: "Google, Apple en Microsoft bewaren jouw herinneringen — en worden er rijker van. FotoApp geeft ze terug aan jou. Geen cloud, geen abonnement, geen surveillance.",
    bron_google_titel: "Google Photos toevoegen",
    bron_google_tekst: "Google Photos kan niet rechtstreeks verbonden worden. Exporteer eerst je foto's via <strong>Google Takeout</strong>:",
    bron_google_stap1: "Ga naar takeout.google.com",
    bron_google_stap2: "Selecteer alleen \"Google Foto's\"",
    bron_google_stap3: "Download de ZIP-bestanden (kan uren duren)",
    bron_google_stap4: "Pak alles uit in één map op je PC",
    bron_google_stap5: "Voeg die map hieronder toe als bron",
    bron_google_note: "✅ De app leest automatisch de Google-metadata mee: datum, GPS-locatie, beschrijving en apparaat.",
    bron_nieuw_titel: "➕ Nieuwe bron toevoegen",
    bron_naam_label: "Naam",
    bron_type_label: "Type",
    bron_map_label: "Map om te scannen",
    bron_bladeren: "📁 Bladeren",
    bron_toevoegen_knop: "Bron toevoegen",
    bron_type_pc: "💻 PC / Laptop",
    bron_type_gsm: "📱 Smartphone",
    bron_type_usb: "💾 USB Stick",
    bron_type_extern: "🗄️ Externe schijf",
    bron_gevaar_titel: "⚠️ Gevaar zone",
    bron_gevaar_tekst: "Wist alle foto-records en scangeschiedenis. Bronnen blijven bewaard — je hoeft ze niet opnieuw in te geven. De echte foto's op schijf blijven onaangeroerd.",
    bron_wis_knop: "🗑️ Wis foto-records",
    filter_alle_bronnen: "Alle bronnen",
    filter_alle_jaren: "Alle jaren",
    filter_alle_landen: "Alle landen",
    filter_alle_cameras: "Alle camera's",
    filter_titel: "Filters",
    filter_wis: "Filters wissen",
    filter_jaar: "Jaar",
    filter_camera: "Camera",
    filter_land: "Land",
    filter_bron: "Bron",
    filter_locatie: "Locatie",
    filter_locatie_alle: "Met of zonder locatie",
    filter_locatie_met: "Met locatie",
    filter_locatie_zonder: "Zonder locatie",
    filter_dup: "Duplicaten",
    filter_dup_alle: "Alle",
    filter_dup_uniek: "Alleen uniek",
    filter_dup_dubbel: "Alleen dubbel",
    zoek_fotos_ph: "🔍 Zoeken op naam, stad, camera...",
    zoek_videos_ph: "🔍 Zoeken op naam, stad...",
    zoek_ph: "🔍 Zoeken...",
    geen_fotos: "Geen foto's gevonden",
    geen_videos: "Geen video's gevonden",
    geen_negeren: "Geen foto's gevonden",
    geen_genegeerd: "Nog geen foto's genegeerd.",
    kaart_alles: "Alles",
    kaart_fotos: "📷 Foto's",
    kaart_videos: "🎬 Video's",
    kaart_wis_filters: "✕ Wis filters",
    gps_titel: "📍 GPS locaties groepsgewijs toewijzen",
    gps_uitleg: "Foto's en video's zonder GPS worden gegroepeerd op tijdstip — meer dan 2 uur verschil = nieuwe groep. Wijs per groep één locatie toe.",
    negeren_titel: "🚫 Foto's negeren",
    negeren_uitleg: "Kies welke foto's je niet wil meenemen naar je nieuwe schijf. Originelen en duplicaten worden apart getoond. Genegeerde foto's worden overgeslagen bij de export.",
    negeren_alle: "Alle foto's",
    negeren_nog_niet: "Nog te beoordelen",
    genegeerd_titel: "📋 Genegeerde foto's",
    genegeerd_uitleg: "Overzicht van foto's die je hebt uitgesloten van de export. Klik op een foto om de keuze ongedaan te maken.",
    genegeerd_leeg: "Nog geen foto's genegeerd.",
    genegeerd_verwijder: "🗑️ Verwijder alle genegeerde definitief",
    export_titel: "📦 Export",
    export_uitleg: "Kopieer je geselecteerde foto's naar een nieuw archief. Originelen blijven altijd onaangeroerd.",
    export_doelmap_label: "Bestemmingsmap",
    export_doelmap_ph: "/media/nieuweschijf/FotoArchief",
    export_kiezen: "📁 Kiezen",
    export_berekenen: "🔍 Berekenen",
    export_te_exporteren: "Te exporteren",
    export_totale_grootte: "Totale grootte",
    export_vrije_ruimte: "Vrije ruimte",
    export_al_gedaan: "Al geëxporteerd",
    export_starten: "▶ Export starten",
    export_stoppen: "⏹ Stoppen",
    export_kopieren: "Kopiëren...",
    export_voltooid: "Export voltooid",
    export_gekopieerd: "Gekopieerd",
    export_fouten_label: "Fouten",
    export_locatie_label: "Locatie",
    export_nieuw: "↩ Nieuw export",
    export_doneer_tekst: "FotoApp heeft jouw foto's veilig gearchiveerd.",
    export_doneer_sub: "Dit project is gratis en blijft gratis. Als het jou geholpen heeft, overweeg dan een kleine bijdrage.",
    export_doneer_paypal: "💳 Doneer via PayPal",
    export_doneer_meer: "Meer info",
    export_onbekend: "Onbekend",
    wrapped_titel: "✨ Jouw foto-leven",
    wrapped_subtitel: "Een overzicht van je hele collectie — deel het met één klik.",
    wrapped_download: "Download als afbeelding",
    wrapped_hint: "Tip: deel 'm op Reddit, Mastodon of bij je vrienden.",
    doneer_titel: "❤️ Steun FotoApp",
    doneer_subtitel: "Van de mens, voor de mens. Gratis en open source — voor altijd.",
    doneer_paypal_titel: "Doneer via PayPal",
    doneer_paypal_tekst: "Kies zelf hoeveel je geeft. Eenmalig, geen verplichtingen.",
    doneer_ander_bedrag: "Ander bedrag kiezen",
    doneer_supporter_titel: "Supporter Edition",
    doneer_supporter_tekst: "Doneer €19 en word vermeld als officiële supporter in de app en op GitHub.",
    doneer_gratis_titel: "Gratis steunen",
    doneer_gratis_tekst: "Geen geld, maar toch bijdragen? Dit helpt net zo goed:",
    doneer_footer: "Vragen of wil je contact?",
    doneer_footer_note: "FotoApp is een hobby-project, gebouwd in vrije tijd. Als je het waardeert, is een donatie een leuke manier om dat te laten weten.",
    modal_bewerk_titel: "✏️ Bron bewerken",
    modal_naam_label: "Naam",
    modal_type_label: "Type",
    modal_naam_ph: "Naam van de bron",
    modal_pad_label: "Map",
    modal_opslaan: "Opslaan",
    modal_annuleren: "Annuleren",
    stat_ready: "Klaar",
    stat_scanning: "Scannen...",
    dup_bijgewerkt: (n) => `✅ ${n} foto's bijgewerkt`,
    video_start_nu: "🖼️ Start nu",
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
    dash_fotos_label: "📷 Photos",
    dash_videos_label: "🎬 Videos",
    lbl_total: "Total",
    lbl_unique: "Unique",
    lbl_duplicate: "Duplicate",
    lbl_with_location: "With location",
    lbl_without_location: "Without location",
    lbl_total_size: "Total size",
    grafiek_fotos_jaar: "📅 Photos per year",
    grafiek_videos_jaar: "🎬 Videos per year",
    grafiek_cameras_fotos: "📷 Cameras (photos)",
    grafiek_cameras_videos: "🎬 Cameras (videos)",
    grafiek_landen_fotos: "🌍 Countries (photos)",
    grafiek_landen_videos: "🌍 Countries (videos)",
    grafiek_per_bron: "💾 Per source",
    fase1_checklist: "📋 Phase 1 checklist",
    fase1_afronden: "Complete phase 1 → Phase 2",
    manifest_titel: "📷 Your photos. Your computer. Your control.",
    manifest_tekst: "Google, Apple and Microsoft store your memories — and profit from them. FotoApp gives them back to you. No cloud, no subscription, no surveillance.",
    bron_google_titel: "Add Google Photos",
    bron_google_tekst: "Google Photos cannot be connected directly. First export your photos via <strong>Google Takeout</strong>:",
    bron_google_stap1: "Go to takeout.google.com",
    bron_google_stap2: "Select only \"Google Photos\"",
    bron_google_stap3: "Download the ZIP files (may take hours)",
    bron_google_stap4: "Extract everything into one folder on your PC",
    bron_google_stap5: "Add that folder below as a source",
    bron_google_note: "✅ The app automatically reads Google metadata: date, GPS location, description and device.",
    bron_nieuw_titel: "➕ Add new source",
    bron_naam_label: "Name",
    bron_type_label: "Type",
    bron_map_label: "Folder to scan",
    bron_bladeren: "📁 Browse",
    bron_toevoegen_knop: "Add source",
    bron_type_pc: "💻 PC / Laptop",
    bron_type_gsm: "📱 Smartphone",
    bron_type_usb: "💾 USB Stick",
    bron_type_extern: "🗄️ External drive",
    bron_gevaar_titel: "⚠️ Danger zone",
    bron_gevaar_tekst: "Wipes all photo records and scan history. Sources are kept — you don't need to re-enter them. The actual photos on disk remain untouched.",
    bron_wis_knop: "🗑️ Wipe photo records",
    filter_alle_bronnen: "All sources",
    filter_alle_jaren: "All years",
    filter_alle_landen: "All countries",
    filter_alle_cameras: "All cameras",
    filter_titel: "Filters",
    filter_wis: "Clear filters",
    filter_jaar: "Year",
    filter_camera: "Camera",
    filter_land: "Country",
    filter_bron: "Source",
    filter_locatie: "Location",
    filter_locatie_alle: "With or without location",
    filter_locatie_met: "With location",
    filter_locatie_zonder: "Without location",
    filter_dup: "Duplicates",
    filter_dup_alle: "All",
    filter_dup_uniek: "Unique only",
    filter_dup_dubbel: "Duplicates only",
    zoek_fotos_ph: "🔍 Search by name, city, camera...",
    zoek_videos_ph: "🔍 Search by name, city...",
    zoek_ph: "🔍 Search...",
    geen_fotos: "No photos found",
    geen_videos: "No videos found",
    geen_negeren: "No photos found",
    geen_genegeerd: "No photos ignored yet.",
    kaart_alles: "All",
    kaart_fotos: "📷 Photos",
    kaart_videos: "🎬 Videos",
    kaart_wis_filters: "✕ Clear filters",
    gps_titel: "📍 Assign GPS locations in bulk",
    gps_uitleg: "Photos and videos without GPS are grouped by time — more than 2 hours difference = new group. Assign one location per group.",
    negeren_titel: "🚫 Ignore photos",
    negeren_uitleg: "Choose which photos you don't want to take to your new drive. Originals and duplicates are shown separately. Ignored photos are skipped during export.",
    negeren_alle: "All photos",
    negeren_nog_niet: "Still to review",
    genegeerd_titel: "📋 Ignored photos",
    genegeerd_uitleg: "Overview of photos you've excluded from export. Click a photo to undo.",
    genegeerd_leeg: "No photos ignored yet.",
    genegeerd_verwijder: "🗑️ Permanently delete all ignored",
    export_titel: "📦 Export",
    export_uitleg: "Copy your selected photos to a new archive. Originals always remain untouched.",
    export_doelmap_label: "Destination folder",
    export_doelmap_ph: "/media/newdrive/PhotoArchive",
    export_kiezen: "📁 Choose",
    export_berekenen: "🔍 Calculate",
    export_te_exporteren: "To export",
    export_totale_grootte: "Total size",
    export_vrije_ruimte: "Free space",
    export_al_gedaan: "Already exported",
    export_starten: "▶ Start export",
    export_stoppen: "⏹ Stop",
    export_kopieren: "Copying...",
    export_voltooid: "Export complete",
    export_gekopieerd: "Copied",
    export_fouten_label: "Errors",
    export_locatie_label: "Location",
    export_nieuw: "↩ New export",
    export_doneer_tekst: "FotoApp has safely archived your photos.",
    export_doneer_sub: "This project is free and stays free. If it helped you, consider a small contribution.",
    export_doneer_paypal: "💳 Donate via PayPal",
    export_doneer_meer: "More info",
    export_onbekend: "Unknown",
    wrapped_titel: "✨ Your photo life",
    wrapped_subtitel: "An overview of your whole collection — share it with one click.",
    wrapped_download: "Download as image",
    wrapped_hint: "Tip: share it on Reddit, Mastodon or with your friends.",
    doneer_titel: "❤️ Support FotoApp",
    doneer_subtitel: "By the people, for the people. Free and open source — forever.",
    doneer_paypal_titel: "Donate via PayPal",
    doneer_paypal_tekst: "Choose how much you give. One-time, no obligations.",
    doneer_ander_bedrag: "Choose another amount",
    doneer_supporter_titel: "Supporter Edition",
    doneer_supporter_tekst: "Donate €19 and be listed as an official supporter in the app and on GitHub.",
    doneer_gratis_titel: "Support for free",
    doneer_gratis_tekst: "No money, but still want to contribute? This helps just as much:",
    doneer_footer: "Questions or want to get in touch?",
    doneer_footer_note: "FotoApp is a hobby project, built in free time. If you appreciate it, a donation is a nice way to show it.",
    modal_bewerk_titel: "✏️ Edit source",
    modal_naam_label: "Name",
    modal_type_label: "Type",
    modal_naam_ph: "Source name",
    modal_pad_label: "Folder",
    modal_opslaan: "Save",
    modal_annuleren: "Cancel",
    stat_ready: "Ready",
    stat_scanning: "Scanning...",
    dup_bijgewerkt: (n) => `✅ ${n} photos updated`,
    video_start_nu: "🖼️ Start now",
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
    dash_fotos_label: "📷 Photos",
    dash_videos_label: "🎬 Vidéos",
    lbl_total: "Total",
    lbl_unique: "Unique",
    lbl_duplicate: "Doublon",
    lbl_with_location: "Avec localisation",
    lbl_without_location: "Sans localisation",
    lbl_total_size: "Taille totale",
    grafiek_fotos_jaar: "📅 Photos par année",
    grafiek_videos_jaar: "🎬 Vidéos par année",
    grafiek_cameras_fotos: "📷 Appareils (photos)",
    grafiek_cameras_videos: "🎬 Appareils (vidéos)",
    grafiek_landen_fotos: "🌍 Pays (photos)",
    grafiek_landen_videos: "🌍 Pays (vidéos)",
    grafiek_per_bron: "💾 Par source",
    fase1_checklist: "📋 Liste de contrôle phase 1",
    fase1_afronden: "Terminer phase 1 → Phase 2",
    manifest_titel: "📷 Vos photos. Votre ordinateur. Votre contrôle.",
    manifest_tekst: "Google, Apple et Microsoft stockent vos souvenirs — et s'enrichissent. FotoApp vous les rend. Pas de cloud, pas d'abonnement, pas de surveillance.",
    bron_google_titel: "Ajouter Google Photos",
    bron_google_tekst: "Google Photos ne peut pas être connecté directement. Exportez d'abord vos photos via <strong>Google Takeout</strong>:",
    bron_google_stap1: "Allez sur takeout.google.com",
    bron_google_stap2: "Sélectionnez uniquement \"Google Photos\"",
    bron_google_stap3: "Téléchargez les fichiers ZIP (peut prendre des heures)",
    bron_google_stap4: "Extrayez tout dans un dossier sur votre PC",
    bron_google_stap5: "Ajoutez ce dossier ci-dessous comme source",
    bron_google_note: "✅ L'app lit automatiquement les métadonnées Google : date, localisation GPS, description et appareil.",
    bron_nieuw_titel: "➕ Ajouter une source",
    bron_naam_label: "Nom",
    bron_type_label: "Type",
    bron_map_label: "Dossier à analyser",
    bron_bladeren: "📁 Parcourir",
    bron_toevoegen_knop: "Ajouter la source",
    bron_type_pc: "💻 PC / Ordinateur portable",
    bron_type_gsm: "📱 Smartphone",
    bron_type_usb: "💾 Clé USB",
    bron_type_extern: "🗄️ Disque externe",
    bron_gevaar_titel: "⚠️ Zone de danger",
    bron_gevaar_tekst: "Efface tous les enregistrements de photos et l'historique. Les sources sont conservées — vous n'avez pas besoin de les ressaisir. Les photos sur le disque restent intactes.",
    bron_wis_knop: "🗑️ Effacer les enregistrements",
    filter_alle_bronnen: "Toutes les sources",
    filter_alle_jaren: "Toutes les années",
    filter_alle_landen: "Tous les pays",
    filter_alle_cameras: "Tous les appareils",
    filter_titel: "Filtres",
    filter_wis: "Effacer les filtres",
    filter_jaar: "Année",
    filter_camera: "Appareil",
    filter_land: "Pays",
    filter_bron: "Source",
    filter_locatie: "Localisation",
    filter_locatie_alle: "Avec ou sans localisation",
    filter_locatie_met: "Avec localisation",
    filter_locatie_zonder: "Sans localisation",
    filter_dup: "Doublons",
    filter_dup_alle: "Tous",
    filter_dup_uniek: "Uniques seulement",
    filter_dup_dubbel: "Doublons seulement",
    zoek_fotos_ph: "🔍 Rechercher par nom, ville, appareil...",
    zoek_videos_ph: "🔍 Rechercher par nom, ville...",
    zoek_ph: "🔍 Rechercher...",
    geen_fotos: "Aucune photo trouvée",
    geen_videos: "Aucune vidéo trouvée",
    geen_negeren: "Aucune photo trouvée",
    geen_genegeerd: "Aucune photo ignorée pour l'instant.",
    kaart_alles: "Tout",
    kaart_fotos: "📷 Photos",
    kaart_videos: "🎬 Vidéos",
    kaart_wis_filters: "✕ Effacer les filtres",
    gps_titel: "📍 Assigner des GPS en groupe",
    gps_uitleg: "Les photos et vidéos sans GPS sont regroupées par heure — plus de 2h d'écart = nouveau groupe. Assignez une localisation par groupe.",
    negeren_titel: "🚫 Ignorer des photos",
    negeren_uitleg: "Choisissez quelles photos vous ne voulez pas emmener sur votre nouveau disque. Les originaux et doublons sont affichés séparément.",
    negeren_alle: "Toutes les photos",
    negeren_nog_niet: "Encore à évaluer",
    genegeerd_titel: "📋 Photos ignorées",
    genegeerd_uitleg: "Aperçu des photos exclues de l'export. Cliquez sur une photo pour annuler.",
    genegeerd_leeg: "Aucune photo ignorée pour l'instant.",
    genegeerd_verwijder: "🗑️ Supprimer définitivement les ignorées",
    export_titel: "📦 Export",
    export_uitleg: "Copiez vos photos sélectionnées vers une nouvelle archive. Les originaux restent toujours intacts.",
    export_doelmap_label: "Dossier de destination",
    export_doelmap_ph: "/media/nouveaudisque/ArchivePhoto",
    export_kiezen: "📁 Choisir",
    export_berekenen: "🔍 Calculer",
    export_te_exporteren: "À exporter",
    export_totale_grootte: "Taille totale",
    export_vrije_ruimte: "Espace libre",
    export_al_gedaan: "Déjà exporté",
    export_starten: "▶ Démarrer l'export",
    export_stoppen: "⏹ Arrêter",
    export_kopieren: "Copie en cours...",
    export_voltooid: "Export terminé",
    export_gekopieerd: "Copié",
    export_fouten_label: "Erreurs",
    export_locatie_label: "Emplacement",
    export_nieuw: "↩ Nouvel export",
    export_doneer_tekst: "FotoApp a archivé vos photos en toute sécurité.",
    export_doneer_sub: "Ce projet est gratuit et le restera. S'il vous a aidé, envisagez une petite contribution.",
    export_doneer_paypal: "💳 Faire un don via PayPal",
    export_doneer_meer: "Plus d'infos",
    export_onbekend: "Inconnu",
    wrapped_titel: "✨ Votre vie en photos",
    wrapped_subtitel: "Un aperçu de toute votre collection — partagez-le en un clic.",
    wrapped_download: "Télécharger comme image",
    wrapped_hint: "Astuce : partagez-le sur Reddit, Mastodon ou avec vos amis.",
    doneer_titel: "❤️ Soutenir FotoApp",
    doneer_subtitel: "Par les gens, pour les gens. Gratuit et open source — pour toujours.",
    doneer_paypal_titel: "Faire un don via PayPal",
    doneer_paypal_tekst: "Choisissez le montant. Unique, sans obligations.",
    doneer_ander_bedrag: "Choisir un autre montant",
    doneer_supporter_titel: "Édition Supporter",
    doneer_supporter_tekst: "Donnez €19 et soyez mentionné comme supporter officiel dans l'app et sur GitHub.",
    doneer_gratis_titel: "Soutenir gratuitement",
    doneer_gratis_tekst: "Pas d'argent mais vous voulez contribuer ? Cela aide tout autant :",
    doneer_footer: "Des questions ou envie de nous contacter ?",
    doneer_footer_note: "FotoApp est un projet hobby, construit pendant le temps libre. Si vous l'appréciez, un don est une belle façon de le montrer.",
    modal_bewerk_titel: "✏️ Modifier la source",
    modal_naam_label: "Nom",
    modal_type_label: "Type",
    modal_naam_ph: "Nom de la source",
    modal_pad_label: "Dossier",
    modal_opslaan: "Enregistrer",
    modal_annuleren: "Annuler",
    stat_ready: "Prêt",
    stat_scanning: "Analyse...",
    dup_bijgewerkt: (n) => `✅ ${n} photos mises à jour`,
    video_start_nu: "🖼️ Démarrer",
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
    dash_fotos_label: "📷 Fotos",
    dash_videos_label: "🎬 Videos",
    lbl_total: "Gesamt",
    lbl_unique: "Eindeutig",
    lbl_duplicate: "Duplikat",
    lbl_with_location: "Mit Standort",
    lbl_without_location: "Ohne Standort",
    lbl_total_size: "Gesamtgröße",
    grafiek_fotos_jaar: "📅 Fotos pro Jahr",
    grafiek_videos_jaar: "🎬 Videos pro Jahr",
    grafiek_cameras_fotos: "📷 Kameras (Fotos)",
    grafiek_cameras_videos: "🎬 Kameras (Videos)",
    grafiek_landen_fotos: "🌍 Länder (Fotos)",
    grafiek_landen_videos: "🌍 Länder (Videos)",
    grafiek_per_bron: "💾 Pro Quelle",
    fase1_checklist: "📋 Checkliste Phase 1",
    fase1_afronden: "Phase 1 abschließen → Phase 2",
    manifest_titel: "📷 Deine Fotos. Dein Computer. Deine Kontrolle.",
    manifest_tekst: "Google, Apple und Microsoft speichern deine Erinnerungen — und profitieren davon. FotoApp gibt sie dir zurück. Keine Cloud, kein Abo, keine Überwachung.",
    bron_google_titel: "Google Photos hinzufügen",
    bron_google_tekst: "Google Photos kann nicht direkt verbunden werden. Exportiere zuerst deine Fotos über <strong>Google Takeout</strong>:",
    bron_google_stap1: "Gehe zu takeout.google.com",
    bron_google_stap2: "Wähle nur \"Google Fotos\"",
    bron_google_stap3: "Lade die ZIP-Dateien herunter (kann Stunden dauern)",
    bron_google_stap4: "Entpacke alles in einen Ordner auf deinem PC",
    bron_google_stap5: "Füge diesen Ordner unten als Quelle hinzu",
    bron_google_note: "✅ Die App liest automatisch Google-Metadaten: Datum, GPS-Standort, Beschreibung und Gerät.",
    bron_nieuw_titel: "➕ Neue Quelle hinzufügen",
    bron_naam_label: "Name",
    bron_type_label: "Typ",
    bron_map_label: "Ordner scannen",
    bron_bladeren: "📁 Durchsuchen",
    bron_toevoegen_knop: "Quelle hinzufügen",
    bron_type_pc: "💻 PC / Laptop",
    bron_type_gsm: "📱 Smartphone",
    bron_type_usb: "💾 USB-Stick",
    bron_type_extern: "🗄️ Externe Festplatte",
    bron_gevaar_titel: "⚠️ Gefahrenzone",
    bron_gevaar_tekst: "Löscht alle Foto-Einträge und den Scan-Verlauf. Quellen bleiben erhalten — du musst sie nicht neu eingeben. Die echten Fotos auf der Festplatte bleiben unberührt.",
    bron_wis_knop: "🗑️ Foto-Einträge löschen",
    filter_alle_bronnen: "Alle Quellen",
    filter_alle_jaren: "Alle Jahre",
    filter_alle_landen: "Alle Länder",
    filter_alle_cameras: "Alle Kameras",
    filter_titel: "Filter",
    filter_wis: "Filter zurücksetzen",
    filter_jaar: "Jahr",
    filter_camera: "Kamera",
    filter_land: "Land",
    filter_bron: "Quelle",
    filter_locatie: "Standort",
    filter_locatie_alle: "Mit oder ohne Standort",
    filter_locatie_met: "Mit Standort",
    filter_locatie_zonder: "Ohne Standort",
    filter_dup: "Duplikate",
    filter_dup_alle: "Alle",
    filter_dup_uniek: "Nur eindeutige",
    filter_dup_dubbel: "Nur Duplikate",
    zoek_fotos_ph: "🔍 Nach Name, Stadt, Kamera suchen...",
    zoek_videos_ph: "🔍 Nach Name, Stadt suchen...",
    zoek_ph: "🔍 Suchen...",
    geen_fotos: "Keine Fotos gefunden",
    geen_videos: "Keine Videos gefunden",
    geen_negeren: "Keine Fotos gefunden",
    geen_genegeerd: "Noch keine Fotos ignoriert.",
    kaart_alles: "Alles",
    kaart_fotos: "📷 Fotos",
    kaart_videos: "🎬 Videos",
    kaart_wis_filters: "✕ Filter löschen",
    gps_titel: "📍 GPS-Standorte gruppenweise zuweisen",
    gps_uitleg: "Fotos und Videos ohne GPS werden nach Zeit gruppiert — mehr als 2 Stunden Unterschied = neue Gruppe. Weise pro Gruppe einen Standort zu.",
    negeren_titel: "🚫 Fotos ignorieren",
    negeren_uitleg: "Wähle, welche Fotos du nicht auf deine neue Festplatte mitnehmen möchtest. Originale und Duplikate werden separat angezeigt.",
    negeren_alle: "Alle Fotos",
    negeren_nog_niet: "Noch zu prüfen",
    genegeerd_titel: "📋 Ignorierte Fotos",
    genegeerd_uitleg: "Übersicht der vom Export ausgeschlossenen Fotos. Klicke auf ein Foto, um die Auswahl rückgängig zu machen.",
    genegeerd_leeg: "Noch keine Fotos ignoriert.",
    genegeerd_verwijder: "🗑️ Alle ignorierten endgültig löschen",
    export_titel: "📦 Export",
    export_uitleg: "Kopiere deine ausgewählten Fotos in ein neues Archiv. Originale bleiben immer unberührt.",
    export_doelmap_label: "Zielordner",
    export_doelmap_ph: "/media/neuefestplatte/FotoArchiv",
    export_kiezen: "📁 Wählen",
    export_berekenen: "🔍 Berechnen",
    export_te_exporteren: "Zu exportieren",
    export_totale_grootte: "Gesamtgröße",
    export_vrije_ruimte: "Freier Speicher",
    export_al_gedaan: "Bereits exportiert",
    export_starten: "▶ Export starten",
    export_stoppen: "⏹ Stoppen",
    export_kopieren: "Kopieren...",
    export_voltooid: "Export abgeschlossen",
    export_gekopieerd: "Kopiert",
    export_fouten_label: "Fehler",
    export_locatie_label: "Speicherort",
    export_nieuw: "↩ Neuer Export",
    export_doneer_tekst: "FotoApp hat deine Fotos sicher archiviert.",
    export_doneer_sub: "Dieses Projekt ist kostenlos und bleibt kostenlos. Wenn es dir geholfen hat, erwäge eine kleine Spende.",
    export_doneer_paypal: "💳 Spenden via PayPal",
    export_doneer_meer: "Mehr Info",
    export_onbekend: "Unbekannt",
    wrapped_titel: "✨ Dein Foto-Leben",
    wrapped_subtitel: "Ein Überblick über deine ganze Sammlung — teile ihn mit einem Klick.",
    wrapped_download: "Als Bild herunterladen",
    wrapped_hint: "Tipp: Teile es auf Reddit, Mastodon oder mit deinen Freunden.",
    doneer_titel: "❤️ FotoApp unterstützen",
    doneer_subtitel: "Von Menschen, für Menschen. Kostenlos und open source — für immer.",
    doneer_paypal_titel: "Spenden via PayPal",
    doneer_paypal_tekst: "Wähle selbst wie viel du gibst. Einmalig, keine Verpflichtungen.",
    doneer_ander_bedrag: "Anderen Betrag wählen",
    doneer_supporter_titel: "Supporter Edition",
    doneer_supporter_tekst: "Spende €19 und werde als offizieller Supporter in der App und auf GitHub gelistet.",
    doneer_gratis_titel: "Kostenlos unterstützen",
    doneer_gratis_tekst: "Kein Geld, aber trotzdem beitragen? Das hilft genauso:",
    doneer_footer: "Fragen oder Kontakt aufnehmen?",
    doneer_footer_note: "FotoApp ist ein Hobbyprojekt, in der Freizeit gebaut. Wenn du es schätzt, ist eine Spende eine nette Art, das zu zeigen.",
    modal_bewerk_titel: "✏️ Quelle bearbeiten",
    modal_naam_label: "Name",
    modal_type_label: "Typ",
    modal_naam_ph: "Name der Quelle",
    modal_pad_label: "Ordner",
    modal_opslaan: "Speichern",
    modal_annuleren: "Abbrechen",
    stat_ready: "Bereit",
    stat_scanning: "Scanne...",
    dup_bijgewerkt: (n) => `✅ ${n} Fotos aktualisiert`,
    video_start_nu: "🖼️ Jetzt starten",
  }
};

const FLAGS  = { nl:"🇳🇱", en:"🇬🇧", fr:"🇫🇷", de:"🇩🇪" };
const LABELS = { nl:"NL",   en:"EN",   fr:"FR",   de:"DE" };

window.i18n = (function() {
  let lang = localStorage.getItem("fotoapp_lang") || "nl";

  function t(key) {
    const val = (APP_TRANSLATIONS[lang] && APP_TRANSLATIONS[lang][key]) ||
                (APP_TRANSLATIONS.nl[key]);
    return val !== undefined ? val : key;
  }

  function applyAll() {
    document.documentElement.lang = lang;

    // 1. Generiek: alle [data-i18n] elementen
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = t(key);
      if (typeof val === 'string' && val !== key) el.textContent = val;
    });

    // 2. Generiek: alle [data-i18n-html] elementen (innerHTML)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      const val = t(key);
      if (typeof val === 'string' && val !== key) el.innerHTML = val;
    });

    // 3. Generiek: alle [data-i18n-placeholder] inputs
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      const val = t(key);
      if (typeof val === 'string' && val !== key) el.placeholder = val;
    });

    // 4. Nav knoppen (data-pagina)
    const navMap = {
      dashboard: t('nav_dashboard'), bronnen: t('nav_bronnen'),
      fotos: t('nav_fotos'),         videos: t('nav_videos'),
      duplicaten: t('nav_duplicaten'), kaart: t('nav_kaart'),
      gpsbulk: t('nav_gps'),         negeren: t('nav_negeren'),
      genegeerd: t('nav_genegeerd'),  export: t('nav_export'),
    };
    document.querySelectorAll('[data-pagina]').forEach(btn => {
      const p = btn.dataset.pagina;
      if (navMap[p]) btn.textContent = navMap[p];
    });

    // 5. Fase labels
    document.querySelectorAll('#stapFase1 .stap-label').forEach(el => el.textContent = t('nav_fase1'));
    document.querySelectorAll('#stapFase2 .stap-label').forEach(el => el.textContent = t('nav_fase2'));
    document.querySelectorAll('#stapFase3 .stap-label').forEach(el => el.textContent = t('nav_fase3'));

    // 6. Steun knop
    const steunBtn = document.querySelector('.doneer-sidebar-knop');
    if (steunBtn) steunBtn.textContent = t('nav_steun');

    // 7. Scan indicator
    const indicator = document.getElementById('scanIndicator');
    if (indicator && !indicator.classList.contains('bezig')) {
      indicator.textContent = t('stat_ready');
    }

    // 8. Select eerste optie vertalen
    [
      ['filterBron',        'filter_alle_bronnen'],
      ['filterBronVideo',   'filter_alle_bronnen'],
      ['kaartJaarFilter',   'filter_alle_jaren'],
      ['kaartLandFilter',   'filter_alle_landen'],
      ['filterJaar',        'filter_alle_jaren'],
      ['filterJaarVideo',   'filter_alle_jaren'],
      ['filterCamera',      'filter_alle_cameras'],
      ['filterCameraVideo', 'filter_alle_cameras'],
      ['filterLand',        'filter_alle_landen'],
      ['filterLandVideo',   'filter_alle_landen'],
    ].forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && el.options[0]) el.options[0].textContent = t(key);
    });

    // Negeren filter opties
    const negerenFilter = document.getElementById('negerenFilter');
    if (negerenFilter && negerenFilter.options.length >= 2) {
      negerenFilter.options[0].textContent = t('negeren_alle');
      negerenFilter.options[1].textContent = t('negeren_nog_niet');
    }

    // Bron type opties
    ['bronType', 'bewerkType'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const keys = ['bron_type_pc','bron_type_gsm','bron_type_usb','bron_type_extern'];
      Array.from(sel.options).forEach((opt, i) => {
        if (keys[i]) opt.textContent = t(keys[i]);
      });
    });

    // 9. Kaart type knoppen
    const kb = [
      ['kaartTypeAlles',  'kaart_alles'],
      ['kaartTypeFotos',  'kaart_fotos'],
      ['kaartTypeVideos', 'kaart_videos'],
    ];
    kb.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    });

    // 10. Taalwisselaar UI
    const flagEl  = document.getElementById('appLangFlag');
    const labelEl = document.getElementById('appLangLabel');
    if (flagEl)  flagEl.textContent  = FLAGS[lang];
    if (labelEl) labelEl.textContent = LABELS[lang];
    document.querySelectorAll('#appLangDropdown .lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    // 11. Dispatch event voor andere modules
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
  const btn      = document.getElementById('appLangBtn');
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

  window.i18n.applyAll();
});
