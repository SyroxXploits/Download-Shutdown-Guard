import type { AppLanguage, AppTheme, ShutdownAction } from './types'

// ─── Translation shape ────────────────────────────────────────────────────────

export interface Translations {
  // App name
  appName: string

  // Nav
  nav: {
    dashboard: string
    settings: string
    about: string
    credits: string
  }

  // Credits page
  credits: {
    title: string
    madeBy: string
    role: string
    thanks: string
    techStack: string
    license: string
    licenseText: string
  }

  // Window controls
  window: {
    minimize: string
    maximize: string
    close: string
  }

  // Shutdown actions
  actions: Record<ShutdownAction, string>

  // Dashboard stats
  dashboard: {
    activeDownloads: string
    totalSpeed: string
    uptime: string
    action: string
    monitorSources: string
    downloads: string
    connecting: string
    noMonitors: string
    noMonitorsDesc: string
    allComplete: string
    allCompleteDesc: string        // {seconds} placeholder
    quickActions: string
    cancel: string
    snooze10: string
    // Watching section
    watchingSection: string
    watchingEmpty: string
    watchingEmptyDesc: string
    detectedSection: string
    detectedEmpty: string
    addButton: string
    removeButton: string
    taskDone: string
    watching: string               // stat label
    // phase labels
    phaseMonitoring: string
    phaseMonitoringActive: string  // {count} placeholder
    phaseMonitoringIdle: string
    phaseNoWatched: string
    phaseCooldown: string
    phaseCooldownDesc: string      // {time} placeholder
    phaseCountdown: string
    phaseCountdownDesc: string     // {seconds} placeholder
    phaseSnoozed: string
    phaseSnoozedDesc: string
    phaseCancelled: string
    phaseCancelledDesc: string
    phaseShuttingDown: string
    phaseShuttingDownDesc: string
  }

  // Monitor labels
  monitors: {
    steam: string
    qbittorrent: string
    utorrent: string
    transmission: string
    browser: string
    generic: string
    installer: string
    notDetected: string
    items: string                  // {count} placeholder
    item: string                   // singular
    moreItems: string              // +{n} more
  }

  // Download states
  states: {
    idle: string
    downloading: string
    installing: string
    paused: string
    seeding: string
    completing: string
    error: string
  }

  // Countdown dialog
  countdown: {
    title: string
    titleExecuting: string
    subtitle: string               // {action} placeholder
    subtitleExecuting: string
    seconds: string
    cancel: string
    snooze: string                 // Snooze 10m
    now: string
    waitingFor: string             // {time}
  }

  // Settings
  settings: {
    title: string
    save: string
    saving: string
    saved: string
    reset: string
    confirmReset: string

    sectionShutdown: string
    actionLabel: string
    cooldown: string
    cooldownDesc: string
    countdownDur: string
    countdownDurDesc: string
    ignoreSeeders: string
    ignoreSeeedersDesc: string
    ignoreNetworkDrop: string
    ignoreNetworkDropDesc: string

    sectionMonitors: string
    monitorDesc: Record<string, string>

    qbtUrl: string
    qbtUser: string
    qbtPass: string
    utorrentUrl: string
    utorrentUser: string
    utorrentPass: string
    transmissionUrl: string
    transmissionUser: string
    transmissionPass: string

    sectionUI: string
    minimizeToTray: string
    minimizeToTrayDesc: string
    startMinimized: string
    startMinimizedDesc: string

    sectionSystem: string
    autoStart: string
    autoStartDesc: string

    sectionNotifications: string
    notifSound: string
    notifSoundDesc: string
    notifVolume: string

    sectionLanguage: string
    languageLabel: string

    sectionTheme: string
    themeLabel: string
    themes: Record<AppTheme, string>

    sectionDiagnostics: string
    openLog: string
  }

  // About
  about: {
    version: string
    description: string
    supportedSources: string
    links: string
    openLog: string
    checkUpdates: string
    checkingUpdates: string
    upToDate: string
    updateAvailable: string
    openRelease: string
    updateFailed: string
    outdatedTitle: string
    outdatedMessage: string
    downloadUpdate: string
    disclaimer: string
    features: string[]
  }

  // Common
  common: {
    eta: string
    speed: string
    yes: string
    no: string
    enabled: string
    disabled: string
    notRunning: string
    connected: string
  }

  // In-app updater dialog
  update: {
    availableTitle: string
    availableMessage: string
    updateNow: string
    later: string
    downloadingTitle: string
    downloadingMessage: string
    downloadedTitle: string
    downloadedMessage: string
    restartNow: string
    errorTitle: string
  }
}

// ─── English ──────────────────────────────────────────────────────────────────

const en: Translations = {
  appName: 'Download Shutdown Guard',

  nav: {
    dashboard: 'Dashboard',
    settings: 'Settings',
    about: 'About',
    credits: 'Credits'
  },

  window: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    close: 'Close'
  },

  actions: {
    shutdown: 'Shut Down',
    signout: 'Sign Out',
    sleep: 'Sleep',
    hibernate: 'Hibernate',
    restart: 'Restart'
  },

  dashboard: {
    activeDownloads: 'Active Tasks',
    totalSpeed: 'Total Speed',
    uptime: 'Uptime',
    action: 'Action',
    monitorSources: 'Monitor Sources',
    downloads: 'Downloads',
    connecting: 'Connecting to monitors…',
    noMonitors: 'No monitors enabled',
    noMonitorsDesc: 'Go to Settings to enable download monitors.',
    allComplete: 'All tasks complete',
    allCompleteDesc: 'Shutdown in {seconds}s if no new activity starts',
    quickActions: 'Quick Actions',
    cancel: 'Cancel',
    snooze10: '+10 min',
    watchingSection: 'Watching',
    watchingEmpty: 'Nothing being watched',
    watchingEmptyDesc: 'Click + next to a detected task to start monitoring it',
    detectedSection: 'Detected Tasks',
    detectedEmpty: 'No active downloads or installs detected',
    addButton: 'Add',
    removeButton: 'Remove',
    taskDone: 'Complete',
    watching: 'Watching',
    phaseMonitoring: 'Monitoring Watched Tasks',
    phaseMonitoringActive: '{count} task(s) in progress',
    phaseMonitoringIdle: 'Waiting — no watched tasks active',
    phaseNoWatched: 'Add tasks below to start monitoring',
    phaseCooldown: 'Cooldown — Confirming Completion',
    phaseCooldownDesc: 'Shutdown in {time} if no new activity starts',
    phaseCountdown: 'Shutdown Countdown',
    phaseCountdownDesc: 'Executing in {seconds}s',
    phaseSnoozed: 'Snoozed',
    phaseSnoozedDesc: 'Monitoring resumes after snooze expires',
    phaseCancelled: 'Shutdown Cancelled',
    phaseCancelledDesc: 'Monitoring resumes when watched tasks are active',
    phaseShuttingDown: 'Executing…',
    phaseShuttingDownDesc: 'Please wait'
  },

  monitors: {
    steam: 'Steam',
    qbittorrent: 'qBittorrent',
    utorrent: 'µTorrent',
    transmission: 'Transmission',
    browser: 'Browsers',
    generic: 'Generic',
    installer: 'Installers & Updates',
    notDetected: 'not detected',
    items: '{count} items',
    item: '1 item',
    moreItems: '+{n} more'
  },

  states: {
    idle: 'Idle',
    downloading: 'Downloading',
    installing: 'Installing',
    paused: 'Paused',
    seeding: 'Seeding',
    completing: 'Completing',
    error: 'Error'
  },

  countdown: {
    title: 'All Tasks Complete',
    titleExecuting: 'Shutting down…',
    subtitle: 'PC will {action} automatically',
    subtitleExecuting: 'Please wait…',
    seconds: 'sec',
    cancel: 'Cancel',
    snooze: 'Snooze 10m',
    now: 'Now',
    waitingFor: '{time} remaining'
  },

  settings: {
    title: 'Settings',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved!',
    reset: 'Reset',
    confirmReset: 'Reset all settings to defaults?',

    sectionShutdown: 'Shutdown Behavior',
    actionLabel: 'Action when tasks complete',
    cooldown: 'Idle cooldown (seconds)',
    cooldownDesc: 'How long all tasks must be done before countdown starts',
    countdownDur: 'Countdown duration (seconds)',
    countdownDurDesc: 'Time shown in the countdown popup before the action executes',
    ignoreSeeders: 'Ignore torrent seeding',
    ignoreSeeedersDesc: 'Seeding-only torrents won\'t prevent shutdown',
    ignoreNetworkDrop: 'Ignore brief network drops',
    ignoreNetworkDropDesc: 'Don\'t reset cooldown on short network interruptions',

    sectionMonitors: 'Download & Install Monitors',
    monitorDesc: {
      steam: 'Detects Steam game downloads via .acf manifests',
      qbittorrent: 'Uses qBittorrent Web API (must be enabled in qBT settings)',
      utorrent: 'Uses the µTorrent Web UI (enable it in µTorrent options)',
      transmission: 'Connects to Transmission RPC endpoint',
      browser: 'Watches Downloads folder for .crdownload, .part files',
      generic: 'Generic file-system download folder monitor',
      installer: 'Detects installers, Windows Update, package managers, and active EA/Ubisoft/Xbox/Microsoft Store installs'
    },

    qbtUrl: 'Web API URL',
    qbtUser: 'Username',
    qbtPass: 'Password',
    utorrentUrl: 'Web UI URL',
    utorrentUser: 'Username',
    utorrentPass: 'Password',
    transmissionUrl: 'RPC URL',
    transmissionUser: 'Username',
    transmissionPass: 'Password',

    sectionUI: 'Interface',
    minimizeToTray: 'Minimize to system tray',
    minimizeToTrayDesc: 'Keep running in the background when closed',
    startMinimized: 'Start minimized',
    startMinimizedDesc: 'Hide window on launch',

    sectionSystem: 'System',
    autoStart: 'Start with Windows',
    autoStartDesc: 'Launch automatically at system startup',

    sectionNotifications: 'Notifications',
    notifSound: 'Notification sound',
    notifSoundDesc: 'Play a sound when shutdown countdown starts',
    notifVolume: 'Volume',

    sectionLanguage: 'Language',
    languageLabel: 'Display language',

    sectionTheme: 'Appearance',
    themeLabel: 'Theme',
    themes: {
      dark: 'Dark',
      black: 'Black',
      light: 'White',
      blue: 'Blue',
      darkblue: 'Dark Blue'
    },

    sectionDiagnostics: 'Diagnostics',
    openLog: 'Open Log'
  },

  about: {
    version: 'Version',
    description:
      'Automatically shuts down, sleeps, signs out, or hibernates your PC once all monitored downloads and installations have completed.',
    supportedSources: 'Supported Sources',
    links: 'Links',
    openLog: 'Open application log',
    checkUpdates: 'Check for updates',
    checkingUpdates: 'Checking for updates...',
    upToDate: 'You are on the latest version.',
    updateAvailable: 'Update available',
    openRelease: 'Open release page',
    updateFailed: 'Could not check for updates.',
    outdatedTitle: 'This version is outdated',
    outdatedMessage: "You're running v{current}. Version v{latest} is available.",
    downloadUpdate: 'Download update',
    disclaimer:
      'This app uses safe Windows system commands. Always keep important work saved before enabling automatic shutdown.',
    features: [
      'Steam — via AppManifest .acf files',
      'qBittorrent — via Web API',
      'Transmission — via RPC',
      'Chrome / Edge / Opera GX — .crdownload files',
      'Firefox — .part files',
      'Installers — msiexec, setup.exe, winget, Windows Update',
      'Generic browser downloads folder monitoring'
    ]
  },

  credits: {
    title: 'Credits',
    madeBy: 'Syrox',
    role: 'Creator & Developer',
    thanks: 'Built with passion for the community.',
    techStack: 'Built with Electron, React, TypeScript & Tailwind CSS.',
    license: 'License',
    licenseText: 'This software is provided free of charge for personal use.'
  },

  common: {
    eta: 'ETA',
    speed: 'Speed',
    yes: 'Yes',
    no: 'No',
    enabled: 'Enabled',
    disabled: 'Disabled',
    notRunning: 'Not running',
    connected: 'Connected'
  },
  update: {
    availableTitle: 'Update available',
    availableMessage: 'Version v{version} is available. Do you want to update now?',
    updateNow: 'Update now',
    later: 'Later',
    downloadingTitle: 'Downloading update…',
    downloadingMessage: 'Downloading v{version}. The app will restart when ready.',
    downloadedTitle: 'Update ready to install',
    downloadedMessage: 'Version v{version} has been downloaded. Restart to finish installing.',
    restartNow: 'Restart & install',
    errorTitle: 'Update failed'
  }
}

// ─── French ───────────────────────────────────────────────────────────────────

const fr: Translations = {
  appName: 'Gardien d\'Extinction',

  nav: {
    dashboard: 'Tableau de bord',
    settings: 'Paramètres',
    about: 'À propos',
    credits: 'Crédits'
  },

  window: {
    minimize: 'Réduire',
    maximize: 'Agrandir',
    close: 'Fermer'
  },

  actions: {
    shutdown: 'Éteindre',
    signout: 'Déconnexion',
    sleep: 'Veille',
    hibernate: 'Hibernation',
    restart: 'Redémarrer'
  },

  dashboard: {
    activeDownloads: 'Tâches actives',
    totalSpeed: 'Vitesse totale',
    uptime: 'Temps d\'activité',
    action: 'Action',
    monitorSources: 'Sources surveillées',
    downloads: 'Téléchargements',
    connecting: 'Connexion aux moniteurs…',
    noMonitors: 'Aucun moniteur activé',
    noMonitorsDesc: 'Allez dans Paramètres pour activer les moniteurs.',
    allComplete: 'Toutes les tâches sont terminées',
    allCompleteDesc: 'Extinction dans {seconds}s si aucune nouvelle activité',
    quickActions: 'Actions rapides',
    cancel: 'Annuler',
    snooze10: '+10 min',
    watchingSection: 'Surveillance',
    watchingEmpty: 'Rien en cours de surveillance',
    watchingEmptyDesc: 'Cliquez sur + pour surveiller une tâche détectée',
    detectedSection: 'Tâches détectées',
    detectedEmpty: 'Aucun téléchargement ou installation détecté',
    addButton: 'Ajouter',
    removeButton: 'Supprimer',
    taskDone: 'Terminé',
    watching: 'Surveillance',
    phaseMonitoring: 'Surveillance des tâches',
    phaseMonitoringActive: '{count} tâche(s) en cours',
    phaseMonitoringIdle: 'En attente — aucune tâche surveillée active',
    phaseNoWatched: 'Ajoutez des tâches ci-dessous pour commencer',
    phaseCooldown: 'Délai de confirmation',
    phaseCooldownDesc: 'Extinction dans {time} si aucune nouvelle activité',
    phaseCountdown: 'Compte à rebours',
    phaseCountdownDesc: 'Exécution dans {seconds}s',
    phaseSnoozed: 'En pause',
    phaseSnoozedDesc: 'La surveillance reprend à l\'expiration du délai',
    phaseCancelled: 'Extinction annulée',
    phaseCancelledDesc: 'La surveillance reprend quand les tâches sont actives',
    phaseShuttingDown: 'Exécution…',
    phaseShuttingDownDesc: 'Veuillez patienter'
  },

  monitors: {
    steam: 'Steam',
    qbittorrent: 'qBittorrent',
    utorrent: 'µTorrent',
    transmission: 'Transmission',
    browser: 'Navigateurs',
    generic: 'Générique',
    installer: 'Installateurs & Mises à jour',
    notDetected: 'non détecté',
    items: '{count} éléments',
    item: '1 élément',
    moreItems: '+{n} autres'
  },

  states: {
    idle: 'Inactif',
    downloading: 'Téléchargement',
    installing: 'Installation',
    paused: 'En pause',
    seeding: 'Partage',
    completing: 'Finalisation',
    error: 'Erreur'
  },

  countdown: {
    title: 'Toutes les tâches sont terminées',
    titleExecuting: 'Extinction en cours…',
    subtitle: 'Le PC va {action} automatiquement',
    subtitleExecuting: 'Veuillez patienter…',
    seconds: 'sec',
    cancel: 'Annuler',
    snooze: 'Reporter 10 min',
    now: 'Maintenant',
    waitingFor: 'Plus que {time}'
  },

  settings: {
    title: 'Paramètres',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    saved: 'Enregistré !',
    reset: 'Réinitialiser',
    confirmReset: 'Réinitialiser tous les paramètres par défaut ?',

    sectionShutdown: 'Comportement à l\'extinction',
    actionLabel: 'Action à la fin des tâches',
    cooldown: 'Délai de confirmation (secondes)',
    cooldownDesc: 'Durée d\'inactivité requise avant le décompte',
    countdownDur: 'Durée du compte à rebours (secondes)',
    countdownDurDesc: 'Durée affichée avant l\'exécution de l\'action',
    ignoreSeeders: 'Ignorer le partage torrent',
    ignoreSeeedersDesc: 'Les torrents en partage seul ne bloquent pas l\'extinction',
    ignoreNetworkDrop: 'Ignorer les coupures réseau brèves',
    ignoreNetworkDropDesc: 'Ne pas réinitialiser le délai lors d\'interruptions courtes',

    sectionMonitors: 'Moniteurs de téléchargement et d\'installation',
    monitorDesc: {
      steam: 'Détecte les téléchargements Steam via les fichiers .acf',
      qbittorrent: 'Utilise l\'API Web de qBittorrent (doit être activée dans qBT)',
      utorrent: 'Utilise l\'interface Web de µTorrent (à activer dans les options µTorrent)',
      transmission: 'Connexion au point de terminaison RPC de Transmission',
      browser: 'Surveille le dossier Téléchargements pour les fichiers .crdownload, .part',
      generic: 'Surveillance générique du dossier de téléchargement',
      installer: 'Détecte les installateurs, Windows Update, les gestionnaires de paquets et les installations EA/Ubisoft/Xbox/Microsoft Store actives'
    },

    qbtUrl: 'URL de l\'API Web',
    qbtUser: 'Nom d\'utilisateur',
    qbtPass: 'Mot de passe',
    utorrentUrl: 'URL de l\'interface Web',
    utorrentUser: 'Nom d\'utilisateur',
    utorrentPass: 'Mot de passe',
    transmissionUrl: 'URL RPC',
    transmissionUser: 'Nom d\'utilisateur',
    transmissionPass: 'Mot de passe',

    sectionUI: 'Interface',
    minimizeToTray: 'Réduire dans la barre système',
    minimizeToTrayDesc: 'Continuer en arrière-plan à la fermeture',
    startMinimized: 'Démarrer réduit',
    startMinimizedDesc: 'Masquer la fenêtre au lancement',

    sectionSystem: 'Système',
    autoStart: 'Démarrer avec Windows',
    autoStartDesc: 'Lancer automatiquement au démarrage du système',

    sectionNotifications: 'Notifications',
    notifSound: 'Son de notification',
    notifSoundDesc: 'Jouer un son au démarrage du compte à rebours',
    notifVolume: 'Volume',

    sectionLanguage: 'Langue',
    languageLabel: 'Langue d\'affichage',

    sectionTheme: 'Apparence',
    themeLabel: 'Thème',
    themes: {
      dark: 'Sombre',
      black: 'Noir',
      light: 'Clair',
      blue: 'Bleu',
      darkblue: 'Bleu nuit'
    },

    sectionDiagnostics: 'Diagnostics',
    openLog: 'Ouvrir le journal'
  },

  about: {
    version: 'Version',
    description:
      'Éteint, met en veille, déconnecte ou met en hibernation automatiquement votre PC à la fin de tous les téléchargements et installations surveillés.',
    supportedSources: 'Sources prises en charge',
    links: 'Liens',
    openLog: 'Ouvrir le journal de l\'application',
    checkUpdates: 'Vérifier les mises à jour',
    checkingUpdates: 'Recherche des mises à jour...',
    upToDate: 'Vous utilisez la dernière version.',
    updateAvailable: 'Mise à jour disponible',
    outdatedTitle: 'Cette version est obsolète',
    outdatedMessage: 'Vous utilisez la v{current}. La version v{latest} est disponible.',
    downloadUpdate: 'Télécharger la mise à jour',
    openRelease: 'Ouvrir la page de publication',
    updateFailed: 'Impossible de vérifier les mises à jour.',
    disclaimer:
      'Cette application utilise des commandes Windows sécurisées. Sauvegardez toujours votre travail avant d\'activer l\'extinction automatique.',
    features: [
      'Steam — via les fichiers AppManifest .acf',
      'qBittorrent — via l\'API Web',
      'Transmission — via RPC',
      'Chrome / Edge / Opera GX — fichiers .crdownload',
      'Firefox — fichiers .part',
      'Installateurs — msiexec, setup.exe, winget, Windows Update',
      'Surveillance générique du dossier de téléchargement'
    ]
  },

  credits: {
    title: 'Crédits',
    madeBy: 'Syrox',
    role: 'Créateur & Développeur',
    thanks: 'Créé avec passion pour la communauté.',
    techStack: 'Développé avec Electron, React, TypeScript & Tailwind CSS.',
    license: 'Licence',
    licenseText: 'Ce logiciel est fourni gratuitement pour un usage personnel.'
  },

  common: {
    eta: 'ETA',
    speed: 'Vitesse',
    yes: 'Oui',
    no: 'Non',
    enabled: 'Activé',
    disabled: 'Désactivé',
    notRunning: 'Non démarré',
    connected: 'Connecté'
  },
  update: {
    availableTitle: 'Mise à jour disponible',
    availableMessage: 'La version v{version} est disponible. Voulez-vous la mettre à jour maintenant ?',
    updateNow: 'Mettre à jour',
    later: 'Plus tard',
    downloadingTitle: 'Téléchargement de la mise à jour…',
    downloadingMessage: "Téléchargement de la v{version}. L'application redémarrera une fois prête.",
    downloadedTitle: 'Mise à jour prête à installer',
    downloadedMessage: 'La version v{version} a été téléchargée. Redémarrez pour terminer l\'installation.',
    restartNow: 'Redémarrer et installer',
    errorTitle: 'Échec de la mise à jour'
  }
}

// ─── Registry & hook ──────────────────────────────────────────────────────────

export const TRANSLATIONS: Record<AppLanguage, Translations> = { en, fr }

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  fr: 'Français'
}

/** Fill in {placeholder} tokens */
export function t(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    str
  )
}
