// ==UserScript==
// @name           CnC-TA-Aktivitätschecker-HE
// @namespace      Harzi
// @version        0.2.68
// @description    Aktivitätschecker – Dashboard mit stundenbasierter Aktivitätsmessung
// @author         Harzi
// @match          https://*.alliances.commandandconquer.com/*/index.aspx*
// @grant          GM_getValue
// @grant          GM_setValue
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // GRUNDEINSTELLUNGEN
    // =========================================================

    const SCRIPT_NAME =
          'CnC-TA Aktivitätschecker - HE';

    const TAB_COUNT = 3;
    const MAX_ALLIANCES = 25;

    const UPDATE_INTERVAL =
          5 * 60 * 1000;

    const AUTO_CHECK_INTERVAL =
          30 * 1000;

    const STORAGE_KEY =
          'CnCTA_Aktivitaetschecker_HE_Settings';

    let qxApp = null;
    let activityWindow = null;

    const tabs = [];

    let currentLanguage = 'de';
    let hourFontSize = 11;

    // =========================================================
    // INTERNES LOGGING – im Produktivbetrieb stumm
    // =========================================================

    const log = {
        section: function () {},
        info: function () {},
        success: function () {},
        warning: function () {},
        error: function () {}
    };

    // =========================================================
    // SPRACHEN
    // =========================================================

    const LANGUAGES = {
        de: {
            name: 'Deutsch',
            tab: 'Allianz',
            alliance: 'Allianz:',
            snapshotNow: 'Snapshot jetzt',
            snapshotNone: 'Snapshot: keiner',
            nextHour: 'Nächste Stunde:',
            automaticSnapshot: 'Automatischer Snapshot',
            time: 'Uhrzeit:',
            save: 'Speichern',
            automaticPrefix: 'Automatik ',
            automaticActiveWord: 'aktiv',
            automaticInactiveWord: 'inaktiv',
            automaticInactive: 'Automatik inaktiv',
            automaticActive: 'Automatik aktiv – ',
            invalidTime: 'Ungültige Uhrzeit!',
            noMeasurement: 'Noch kein Messzyklus gestartet.',
            measurementActive: 'Messung aktiv | Stunde ',
            selectedAlliance: 'Allianz "{0}" ausgewählt.',
            snapshotFetching: 'Snapshot wird abgerufen ...',
            playersRecorded: '{0} Spieler erfasst',
            language: 'Sprache:',
            pointSize: 'Punktgröße:',
            nextUpdate: 'Nächste Aktualisierung: '
        },
        en: {
            name: 'English',
            tab: 'Alliance',
            alliance: 'Alliance:',
            snapshotNow: 'Snapshot now',
            snapshotNone: 'Snapshot: none',
            nextHour: 'Next hour:',
            automaticSnapshot: 'Automatic snapshot',
            time: 'Time:',
            save: 'Save',
            automaticInactive: 'Automatic inactive',
            automaticActive: 'Automatic active – ',
            invalidTime: 'Invalid time!',
            noMeasurement: 'No measurement cycle started yet.',
            measurementActive: 'Measurement active | Hour ',
            selectedAlliance: 'Alliance "{0}" selected.',
            snapshotFetching: 'Retrieving snapshot ...',
            playersRecorded: '{0} players recorded',
            language: 'Language:',
            pointSize: 'Point size:',
            nextUpdate: 'Next update: '
        },
        fr: {
            name: 'Français',
            tab: 'Alliance',
            alliance: 'Alliance :',
            snapshotNow: 'Snapshot maintenant',
            snapshotNone: 'Snapshot : aucun',
            nextHour: 'Prochaine heure :',
            automaticSnapshot: 'Snapshot automatique',
            time: 'Heure :',
            save: 'Enregistrer',
            automaticPrefix: 'Automatisation ',
            automaticActiveWord: 'active',
            automaticInactiveWord: 'inactive',
            automaticInactive: 'Automatisation inactive',
            automaticActive: 'Automatisation active – ',
            invalidTime: 'Heure invalide !',
            noMeasurement: 'Aucun cycle de mesure démarré.',
            measurementActive: 'Mesure active | Heure ',
            selectedAlliance: 'Alliance « {0} » sélectionnée.',
            snapshotFetching: 'Récupération du snapshot ...',
            playersRecorded: '{0} joueurs enregistrés',
            language: 'Langue :',
            pointSize: 'Taille des points :',
            nextUpdate: 'Prochaine mise à jour : '
        },
        es: {
            name: 'Español',
            tab: 'Alianza',
            alliance: 'Alianza:',
            snapshotNow: 'Snapshot ahora',
            snapshotNone: 'Snapshot: ninguno',
            nextHour: 'Próxima hora:',
            automaticSnapshot: 'Snapshot automático',
            time: 'Hora:',
            save: 'Guardar',
            automaticPrefix: 'Automatización ',
            automaticActiveWord: 'activa',
            automaticInactiveWord: 'inactiva',
            automaticInactive: 'Automatización inactiva',
            automaticActive: 'Automatización activa – ',
            invalidTime: '¡Hora no válida!',
            noMeasurement: 'Aún no se ha iniciado ningún ciclo de medición.',
            measurementActive: 'Medición activa | Hora ',
            selectedAlliance: 'Alianza « {0} » seleccionada.',
            snapshotFetching: 'Obteniendo snapshot ...',
            playersRecorded: '{0} jugadores registrados',
            language: 'Idioma:',
            pointSize: 'Tamaño de puntos:',
            nextUpdate: 'Próxima actualización: '
        }
    };

    function t(key) {
        const lang = LANGUAGES[currentLanguage] || LANGUAGES.de;
        return lang[key] !== undefined ? lang[key] : LANGUAGES.de[key];
    }

    function tFormat(key, value) {
        return t(key).replace('{0}', value);
    }

    // =========================================================
    // STANDARD-EINSTELLUNGEN
    // =========================================================

    function getDefaultSettings() {

        return {
            language: 'de',
            hourFontSize: 11,
            tabs: [
                {
                    alliance: '',
                    automatic: false,
                    automaticTime: '21:00'
                },
                {
                    alliance: '',
                    automatic: false,
                    automaticTime: '21:00'
                },
                {
                    alliance: '',
                    automatic: false,
                    automaticTime: '21:00'
                }
            ]
        };
    }

    // =========================================================
    // EINSTELLUNGEN LADEN
    // =========================================================

    function loadSettings() {

        const defaults =
              getDefaultSettings();

        try {

            const saved =
                  GM_getValue(
                      STORAGE_KEY,
                      null
                  );

            if (!saved) {

                log.info(
                    'Keine gespeicherten Einstellungen vorhanden.'
                );

                return defaults;
            }

            const parsed =
                  typeof saved === 'string'
            ? JSON.parse(saved)
            : saved;

            if (
                !parsed ||
                !Array.isArray(parsed.tabs)
            ) {

                log.warning(
                    'Gespeicherte Einstellungen sind ungültig.'
                );

                return defaults;
            }

            defaults.language =
                LANGUAGES[parsed.language] ? parsed.language : 'de';

            currentLanguage = defaults.language;

            const parsedHourFontSize = Number(parsed.hourFontSize);
            hourFontSize = Number.isInteger(parsedHourFontSize) &&
                parsedHourFontSize >= 9 &&
                parsedHourFontSize <= 12
                ? parsedHourFontSize
            : 11;

            defaults.hourFontSize = hourFontSize;

            for (
                let i = 0;
                i < TAB_COUNT;
                i++
            ) {

                if (!parsed.tabs[i]) {
                    continue;
                }

                defaults.tabs[i].alliance =
                    typeof parsed.tabs[i].alliance === 'string'
                    ? parsed.tabs[i].alliance
                : '';

                // Die Automatik wird ausschließlich über Reiter 1 gesteuert.
                if (i === 0) {
                    defaults.tabs[i].automatic =
                        parsed.tabs[i].automatic === true;

                    defaults.tabs[i].automaticTime =
                        typeof parsed.tabs[i].automaticTime === 'string'
                        ? parsed.tabs[i].automaticTime
                    : '21:00';
                } else {
                    defaults.tabs[i].automatic = false;
                    defaults.tabs[i].automaticTime = '21:00';
                }

                // Persistierte Spaltenbreiten pro Reiter
                defaults.tabs[i].columnWidths =
                    Array.isArray(parsed.tabs[i].columnWidths)
                    ? parsed.tabs[i].columnWidths.slice(0, 28)
                : null;

                // Persistierter Messzustand
                defaults.tabs[i].measurement =
                    parsed.tabs[i].measurement || null;
            }

            log.success(
                'Gespeicherte Einstellungen geladen.',
                defaults
            );

            return defaults;

        } catch (e) {

            log.error(
                'Fehler beim Laden der Einstellungen:',
                e
            );

            return defaults;
        }
    }

    // =========================================================
    // EINSTELLUNGEN + MESSZUSTAND SPEICHERN
    // =========================================================

    // =========================================================
    // ALLIANZ EINES EINZELNEN REITERS SOFORT SPEICHERN
    // =========================================================
    //
    // Wird beim echten Allianzwechsel aufgerufen. Die Auswahl wird damit
    // unabhängig von späteren Mess-/Timer-Aktualisierungen sofort in
    // GM_setValue geschrieben. Der Messzustand dieses Reiters bleibt bis
    // zum erfolgreichen Laden der neuen Allianz bewusst leer.
    function persistTabAllianceSelection(tab) {

        if (!tab) {
            return;
        }

        try {

            const settings =
                  loadSettings();

            if (!Array.isArray(settings.tabs)) {
                settings.tabs = [];
            }

            while (settings.tabs.length < TAB_COUNT) {
                settings.tabs.push({
                    alliance: '',
                    automatic: false,
                    automaticTime: '21:00',
                    columnWidths: null,
                    measurement: null
                });
            }

            const index = tab.index;

            if (!settings.tabs[index]) {
                settings.tabs[index] = {
                    alliance: '',
                    automatic: false,
                    automaticTime: '21:00',
                    columnWidths: null,
                    measurement: null
                };
            }

            settings.tabs[index].alliance =
                tab.allianceName || '';

            // Der alte Messzustand gehört zur alten Allianz und darf beim
            // nächsten Öffnen nicht wiederhergestellt werden.
            settings.tabs[index].measurement = null;

            GM_setValue(
                STORAGE_KEY,
                settings
            );

            log.success(
                'Allianz von Reiter ' +
                (index + 1) +
                ' sofort gespeichert: "' +
                (tab.allianceName || '') +
                '".'
            );

        } catch (e) {

            log.error(
                'Allianz von Reiter ' +
                (tab.index + 1) +
                ' konnte nicht sofort gespeichert werden.',
                e
            );
        }
    }

    function saveSettings() {

        try {

            const settings = {
                language: currentLanguage,
                hourFontSize: hourFontSize,
                tabs: []
            };

            for (
                let i = 0;
                i < TAB_COUNT;
                i++
            ) {

                const tab = tabs[i];

                if (!tab) {

                    settings.tabs.push({
                        alliance: '',
                        automatic: false,
                        automaticTime: '21:00',
                        columnWidths: null,
                        measurement: null
                    });

                    continue;
                }

                settings.tabs.push({
                    alliance: tab.allianceName || '',
                    // Die Automatik wird ausschließlich über Reiter 1 gespeichert.
                    automatic: i === 0
                    ? !!tab.automaticEnabled
                    : false,
                    automaticTime: i === 0
                    ? (tab.automaticTimeValue || '21:00')
                    : '21:00',

                    // Individuelle Tabellenbreiten werden pro Reiter gespeichert.
                    columnWidths: (function () {
                        if (!tab.windowOpen || !tab.columnModel) {
                            return tab.columnWidths || null;
                        }

                        try {
                            return Array.from(
                                { length: 28 },
                                function (_, col) {
                                    return tab.columnModel.getColumnWidth(col);
                                }
                            );
                        } catch (columnError) {
                            log.warning(
                                'Spaltenbreiten konnten beim Speichern nicht gelesen werden – Messdaten werden trotzdem gespeichert.',
                                columnError
                            );
                            return tab.columnWidths || null;
                        }
                    })(),

                    // Der Messzustand wird ebenfalls dauerhaft gespeichert.
                    measurement: tab.startSnapshotPlayers
                    ? {
                        startSnapshotTime: tab.startSnapshotTime
                        ? tab.startSnapshotTime.toISOString()
                        : null,
                        startSnapshotPlayers: tab.startSnapshotPlayers,
                        hourReferencePlayers: tab.hourReferencePlayers,
                        hourReferenceStartTime: tab.hourReferenceStartTime
                        ? tab.hourReferenceStartTime.toISOString()
                        : null,
                        currentPlayers: tab.currentPlayers,
                        completedHours: tab.completedHours,
                        currentHourIndex: tab.currentHourIndex,
                        lastAutomaticSnapshotDate: tab.lastAutomaticSnapshotDate || null,
                        requestGeneration: tab.requestGeneration || 0
                    }
                    : null
                });
            }

            GM_setValue(
                STORAGE_KEY,
                settings
            );

            const verify =
                  GM_getValue(
                      STORAGE_KEY,
                      null
                  );

            if (!verify) {
                throw new Error(
                    'Speicherung konnte nicht verifiziert werden.'
                );
            }

            log.success(
                'Einstellungen und Messdaten dauerhaft gespeichert und geprüft.',
                settings
            );

        } catch (e) {

            log.error(
                'Fehler beim Speichern der Einstellungen/Messdaten:',
                e
            );
        }
    }

    // =========================================================
    // PERSISTIERTEN MESSZUSTAND WIEDERHERSTELLEN
    // =========================================================

    function restoreMeasurement(tab, saved) {

        if (!saved || !saved.measurement) {
            return false;
        }

        try {

            const measurement = saved.measurement;

            tab.startSnapshotTime = measurement.startSnapshotTime
                ? new Date(measurement.startSnapshotTime)
            : null;

            tab.startSnapshotPlayers =
                measurement.startSnapshotPlayers || null;

            tab.hourReferencePlayers =
                measurement.hourReferencePlayers || null;

            tab.hourReferenceStartTime =
                measurement.hourReferenceStartTime
                ? new Date(measurement.hourReferenceStartTime)
            : (measurement.startSnapshotTime
               ? new Date(measurement.startSnapshotTime)
               : null);

            tab.currentPlayers =
                measurement.currentPlayers || null;

            tab.completedHours =
                Array.isArray(measurement.completedHours)
                ? measurement.completedHours
            : [];

            tab.currentHourIndex =
                Number.isInteger(measurement.currentHourIndex)
                ? Math.max(0, Math.min(23, measurement.currentHourIndex))
            : 0;

            tab.lastAutomaticSnapshotDate =
                measurement.lastAutomaticSnapshotDate || null;

            tab.requestGeneration =
                Number.isInteger(measurement.requestGeneration)
                ? measurement.requestGeneration
            : 0;

            tab.automaticSnapshotInProgress = false;

            if (!tab.startSnapshotPlayers) {
                return false;
            }

            // Tabelle aus dem gespeicherten Snapshot wieder aufbauen.
            const players = mapToPlayers(tab.currentPlayers || tab.startSnapshotPlayers);

            updateTable(tab, players);
            updateStatus(tab);

            log.success(
                'Gespeicherter Messzustand für Reiter ' +
                (tab.index + 1) +
                ' wiederhergestellt. ' +
                Object.keys(tab.startSnapshotPlayers).length +
                ' Spieler.'
            );

            return true;

        } catch (e) {

            log.error(
                'Fehler beim Wiederherstellen des Messzustands:',
                e
            );

            return false;
        }
    }

    function mapToPlayers(map) {

        if (!map || typeof map !== 'object') {
            return [];
        }

        return Object.keys(map).map(function (name) {

            const p = map[name] || {};

            return {
                pn: p.name || name,
                r: p.rank || 0,
                s: p.points || 0,
                an: p.alliance || ''
            };
        });
    }

    // =========================================================
    // ZEIT FORMATIEREN
    // =========================================================

    function formatTime(date) {

        return (
            String(
                date.getHours()
            ).padStart(2, '0')
            +
            ':'
            +
            String(
                date.getMinutes()
            ).padStart(2, '0')
        );
    }

    // =========================================================
    // STUNDENÜBERSCHRIFT
    // =========================================================

    function getHourLabel(hour) {

        const end =
              (hour + 1) % 24;

        return (
            String(hour).padStart(2, '0')
            +
            '–'
            +
            String(end).padStart(2, '0')
        );
    }

    // =========================================================
    // TOP 25 ALLIANZEN
    // =========================================================

    function requestTop25Alliances(
    onSuccess
    ) {

        log.section(
            'TOP-25-ALLIANZEN ABRUF'
        );

        try {

            const view =
                  ClientLib.Data.Ranking.EViewType.Alliance;

            const rankingType = 0;

            const sortColumn =
                  ClientLib.Data.Ranking.ESortColumn.Rank;

            ClientLib.Net.CommunicationManager
                .GetInstance()
                .SendSimpleCommand(

                'RankingGetData',

                {
                    firstIndex: 0,
                    lastIndex: 24,
                    view: view,
                    rankingType: rankingType,
                    sortColumn: sortColumn,
                    ascending: true
                },

                phe.cnc.Util.createEventDelegate(

                    ClientLib.Net.CommandResult,

                    this,

                    function (
                    context,
                     data
                    ) {

                        if (
                            !data ||
                            !Array.isArray(data.a)
                        ) {

                            log.error(
                                'Keine gültigen Allianz-Daten erhalten.',
                                data
                            );

                            return;
                        }

                        const alliances =
                              data.a
                        .filter(
                            function (alliance) {

                                return (
                                    alliance &&
                                    alliance.an
                                );
                            }
                        )
                        .slice(
                            0,
                            MAX_ALLIANCES
                        );

                        log.success(
                            alliances.length +
                            ' Allianzen erhalten.'
                        );

                        if (
                            typeof onSuccess ===
                            'function'
                        ) {

                            onSuccess(
                                alliances
                            );
                        }
                    }
                ),

                null
            );

        } catch (e) {

            log.error(
                'Fehler beim Allianz-Abruf:',
                e
            );

        }
    }

    // =========================================================
    // SPIELER ABRUFEN
    // =========================================================

    function requestAlliancePlayers(
    allianceName,
     onSuccess,
     onFailure
    ) {

        if (!allianceName) {

            log.warning(
                'Keine Allianz ausgewählt.'
            );

            return;
        }

        try {

            const view =
                  ClientLib.Data.Ranking.EViewType.Player;

            const rankingType = 0;

            const sortColumn =
                  ClientLib.Data.Ranking.ESortColumn.Rank;

            ClientLib.Net.CommunicationManager
                .GetInstance()
                .SendSimpleCommand(

                'RankingGetData',

                {
                    firstIndex: 0,
                    lastIndex: 999,
                    view: view,
                    rankingType: rankingType,
                    sortColumn: sortColumn,
                    ascending: true
                },

                phe.cnc.Util.createEventDelegate(

                    ClientLib.Net.CommandResult,

                    this,

                    function (
                    context,
                     data
                    ) {

                        if (
                            !data ||
                            !Array.isArray(data.p)
                        ) {

                            log.error(
                                'Keine gültigen Spielerdaten erhalten.',
                                data
                            );

                            if (typeof onFailure === 'function') {
                                onFailure(new Error('Keine gültigen Spielerdaten erhalten.'));
                            }

                            return;
                        }

                        const players =
                              data.p.filter(
                                  function (player) {

                                      return (
                                          player &&
                                          player.pn &&
                                          player.an ===
                                          allianceName
                                      );
                                  }
                              );

                        log.success(
                            players.length +
                            ' Spieler der Allianz "' +
                            allianceName +
                            '" erhalten.'
                        );

                        if (
                            typeof onSuccess ===
                            'function'
                        ) {

                            onSuccess(
                                players
                            );
                        }
                    }
                ),

                null
            );

        } catch (e) {

            log.error(
                'Fehler beim Spieler-Abruf:',
                e
            );

            if (typeof onFailure === 'function') {
                onFailure(e);
            }
        }
    }

    // =========================================================
    // SPIELERMAP
    // =========================================================

    function createPlayerMap(
    players
    ) {

        const map = {};

        players.forEach(
            function (player) {

                if (
                    !player ||
                    !player.pn
                ) {

                    return;
                }

                map[player.pn] = {

                    name:
                    player.pn,

                    rank:
                    Number(
                        player.r || 0
                    ),

                    points:
                    Number(
                        player.s || 0
                    ),

                    alliance:
                    player.an || ''
                };
            }
        );

        return map;
    }

    // =========================================================
    // NEUEN MESSZYKLUS
    // =========================================================

    function startNewMeasurement(
    tab,
     players,
     reason
    ) {

        const now = getGameServerDate();

        const playerMap = createPlayerMap(players);

        tab.startSnapshotTime = now;
        tab.startSnapshotPlayers = playerMap;

        // Der Snapshot ist der feste Ausgangswert des gesamten Zyklus.
        // Für die erste Stunde ist er gleichzeitig der Referenzwert.
        tab.hourReferencePlayers = playerMap;
        tab.hourReferenceStartTime = now;

        tab.completedHours = [];
        tab.currentHourIndex = now.getHours();
        tab.currentPlayers = playerMap;

        if (tab.windowOpen) {
            updateTable(tab, players);
            updateStatus(tab);
        }

        log.success(
            'Neuer Messzyklus gestartet (' + reason + ').'
        );

        log.info('Start-Snapshot: ' + formatTime(now));
        log.info(
            'Aktuelle Messstunde: ' +
            getHourLabel(tab.currentHourIndex) +
            ' – Referenz ' + formatTime(tab.hourReferenceStartTime)
        );
        log.info(
            'Spieler im Snapshot: ' +
            Object.keys(playerMap).length
        );

        if (tab.windowOpen) {
            updateNextHourDisplay(tab, now);
        }
        saveSettings();
    }

    // =========================================================
    // MESSRUNDE ZURÜCKSETZEN – DARSTELLUNG SOFORT LEEREN
    // =========================================================

    function resetMeasurementDisplay(tab, reason) {

        if (!tab) {
            return;
        }

        // Alle noch laufenden Netzwerkantworten aus der alten Messrunde
        // werden ungültig. Sie dürfen die neue Runde nicht wieder mit alten
        // Werten überschreiben.
        tab.requestGeneration = (tab.requestGeneration || 0) + 1;

        // Alte Messwerte und Referenzen vollständig verwerfen.
        tab.startSnapshotTime = null;
        tab.startSnapshotPlayers = null;
        tab.hourReferencePlayers = null;
        tab.hourReferenceStartTime = null;
        tab.currentPlayers = null;
        tab.completedHours = [];
        tab.currentHourIndex = -1;

        // Bereits angezeigte Tabellenwerte sofort entfernen – nur wenn
        // das Fenster aktuell geöffnet ist. Im Hintergrund gibt es keine
        // gültige QoX-Darstellung mehr, der Messzustand bleibt aber erhalten.
        if (tab.windowOpen) {
            if (tab.tableModel) {
                tab.tableModel.setData([]);
            }

            if (tab.snapshotLabel) {
                tab.snapshotLabel.setValue(t('snapshotFetching'));
            }

            if (tab.statusLabel) {
                tab.statusLabel.setValue(t('snapshotFetching'));
            }
        }

        if (tab.nextCheckLabel) {
            tab.nextCheckLabel.setValue('');
        }

        log.info(
            'Messrunde von Reiter ' + (tab.index + 1) +
            ' zurückgesetzt (' + reason + ').'
        );
    }

    // =========================================================
    // SNAPSHOT – ALLE KONFIGURIERTEN REITER
    // =========================================================

    function performSnapshotAllTabs(reason, onComplete) {

        log.section(
            'SNAPSHOT – ALLE KONFIGURIERTEN ALLIANZEN'
        );

        const trackedTabs = tabs.filter(function (tab) {
            return !!tab.allianceName;
        });

        if (trackedTabs.length === 0) {
            log.warning(
                'Kein Reiter enthält eine ausgewählte Allianz.'
            );

            if (typeof onComplete === 'function') {
                onComplete(false);
            }

            return;
        }

        let pending = trackedTabs.length;
        let successCount = 0;
        let failureCount = 0;

        function finishOne(success) {
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }

            pending--;

            if (pending > 0) {
                return;
            }

            const allSuccessful = failureCount === 0 && successCount === trackedTabs.length;

            log.info(
                'Snapshot-Abschluss: ' +
                successCount + '/' + trackedTabs.length + ' erfolgreich.'
            );

            if (typeof onComplete === 'function') {
                onComplete(allSuccessful);
            }
        }

        trackedTabs.forEach(function (tab) {

            if (tab.windowOpen && tab.statusLabel) {
                tab.statusLabel.setValue(
                    t('snapshotFetching')
                );
            }

            requestAlliancePlayers(
                tab.allianceName,
                function (players) {

                    // Ein Snapshot invalidiert ebenfalls eventuell noch
                    // laufende alte Aktualisierungsantworten.
                    tab.requestGeneration = (tab.requestGeneration || 0) + 1;
                    tab.automaticSnapshotInProgress = false;

                    startNewMeasurement(
                        tab,
                        players,
                        reason || 'manuell'
                    );

                    if (tab.windowOpen && tab.statusLabel) {
                        tab.statusLabel.setValue(
                            players.length +
                            ' Spieler erfasst'
                        );
                    }

                    finishOne(true);
                },
                function (error) {

                    tab.automaticSnapshotInProgress = false;

                    log.error(
                        'Snapshot für Reiter ' + (tab.index + 1) +
                        ' fehlgeschlagen.',
                        error
                    );

                    finishOne(false);
                }
            );
        });

        log.success(
            'Snapshot für ' +
            trackedTabs.length +
            ' konfigurierte Allianz(en) gestartet.'
        );
    }

    // =========================================================
    // C&C-TA SERVERZEIT
    // =========================================================

    function getGameServerDate() {

        try {
            const mainData = ClientLib.Data.MainData.GetInstance();
            const gameTime = mainData.get_Time();

            if (gameTime) {

                const serverStep =
                      typeof gameTime.GetServerStep === 'function'
                ? gameTime.GetServerStep()
                : null;

                // GetJSStepTime liefert den Spielzeitpunkt als JavaScript-Zeit.
                // Genau diese Funktion wird auch von anderen TA-Scripts für
                // die Umrechnung von Server-Steps in JS-Zeit verwendet.
                if (
                    serverStep !== null &&
                    typeof gameTime.GetJSStepTime === 'function'
                ) {
                    const jsTime =
                          gameTime.GetJSStepTime(serverStep);

                    if (jsTime instanceof Date) {
                        return new Date(jsTime.getTime());
                    }

                    if (typeof jsTime === 'number') {
                        return new Date(jsTime);
                    }
                }
            }

        } catch (e) {
            log.warning(
                'Serverzeit konnte nicht gelesen werden: ' + e
            );
        }

        // Sicherheits-Fallback. Die Messung läuft weiter, falls eine ältere
        // TA-Version GetJSStepTime nicht bereitstellt.
        return new Date();
    }

    // =========================================================
    // LAUFENDE AKTUALISIERUNG
    // =========================================================

    function refreshCurrentActivity(
    tab
    ) {

        if (
            !tab.startSnapshotPlayers ||
            !tab.allianceName
        ) {
            return;
        }

        const requestGeneration = tab.requestGeneration || 0;

        requestAlliancePlayers(
            tab.allianceName,
            function (players) {

                // Antwort gehört noch zur aktuell gültigen Messrunde?
                if (requestGeneration !== (tab.requestGeneration || 0)) {
                    log.warning(
                        'Veraltete Aktualisierungsantwort verworfen (Reiter ' +
                        (tab.index + 1) + ').'
                    );
                    return;
                }

                const currentMap = createPlayerMap(players);
                const now = getGameServerDate();

                log.info(
                    'Serverzeit: ' + formatTime(now) +
                    ' | Server-Stunde: ' + now.getHours() +
                    ' | bisherige Messstunde: ' + tab.currentHourIndex
                );

                // Vor jeder Darstellung wird anhand der C&C-TA-Serverzeit
                // geprüft, ob eine oder mehrere volle Stunden erreicht wurden.
                reconcileCurrentHour(tab, currentMap, now);

                tab.currentPlayers = currentMap;

                if (tab.windowOpen) {
                    updateTable(tab, players);
                    updateStatus(tab);
                    updateNextHourDisplay(tab, now);
                }

                log.info(
                    '5-MINUTEN-ABFRAGE abgeschlossen – Reiter ' +
                    (tab.index + 1) +
                    ' | ' + tab.allianceName +
                    ' | Serverzeit ' + formatTime(now)
                );

                saveSettings();
            }
        );
    }

    // =========================================================
    // STUNDENWECHSEL – ZEITBASIERT, NICHT TIMERBASIERT
    // =========================================================

    function getHourNumberFromDate(date) {
        return date.getHours();
    }

    function updateNextHourDisplay(tab, now) {

        const next = new Date(now);
        next.setHours(now.getHours() + 1, 0, 0, 0);

        tab.nextHourTime = next;

        if (tab.nextCheckLabel) {
            tab.nextCheckLabel.setValue(
                t('nextHour') + ' ' + formatTime(next)
            );
        }
    }

    function completeCurrentHour(
    tab,
     currentMap,
     hourIndex
    ) {

        if (!tab.hourReferencePlayers) {
            return;
        }

        const hourData = {};
        const referenceMap = tab.hourReferencePlayers;

        Object.keys(referenceMap).forEach(function (playerName) {

            const reference = referenceMap[playerName];
            const current = currentMap[playerName];

            if (!current) {
                hourData[playerName] = null;
                return;
            }

            hourData[playerName] =
                current.points - reference.points;
        });

        tab.completedHours[hourIndex] = hourData;

        log.success(
            'Stunde ' + getHourLabel(hourIndex) + ' abgeschlossen.'
        );
    }

    function reconcileCurrentHour(
    tab,
     currentMap,
     now
    ) {

        if (
            !tab.startSnapshotPlayers ||
            !tab.hourReferencePlayers
        ) {
            return;
        }

        const actualHour = getHourNumberFromDate(now);

        // Normalfall: wir befinden uns noch in derselben Stunde.
        if (actualHour === tab.currentHourIndex) {
            return;
        }

        // Ermitteln, wie viele Stunden seit der bisherigen Referenzstunde
        // vergangen sind.
        const steps =
              (actualHour - tab.currentHourIndex + 24) % 24;

        if (steps === 0) {
            return;
        }

        if (steps > 1) {

            /*
         * Wir waren mehrere Stunden nicht online.
         *
         * Die genaue Stunde der Punkteveränderung ist unbekannt.
         * Deshalb wird die gesamte Veränderung seit der letzten
         * bekannten Referenz der ersten Stunde nach der Rückkehr
         * zugeordnet.
         *
         * Die bisherige hourReferencePlayers-Referenz bleibt erhalten.
         */
            log.warning(
                'Es wurden ' + steps +
                ' Stunden seit der letzten Messung übersprungen. ' +
                'Die gesamte Punkteveränderung wird der ersten Stunde nach ' +
                'der Rückkehr (' + getHourLabel(actualHour) + ') zugeordnet.'
            );

            /*
         * Nur die aktuelle Stunde wechseln.
         *
         * WICHTIG:
         * hourReferencePlayers bleibt unverändert!
         */
            tab.currentHourIndex = actualHour;

            /*
         * Die Referenzzeit wird ebenfalls auf den Beginn
         * der aktuellen Stunde gesetzt.
         */
            tab.hourReferenceStartTime = new Date(now);
            tab.hourReferenceStartTime.setMinutes(0, 0, 0);

        } else {

            // Genau eine volle Stunde wurde seit der letzten Messung erreicht.
            // Die bisherige Stunde kann mit dem aktuellen Messpunkt
            // abgeschlossen werden.

            completeCurrentHour(
                tab,
                currentMap,
                tab.currentHourIndex
            );

            tab.currentHourIndex = actualHour;
            tab.hourReferencePlayers = currentMap;
            tab.hourReferenceStartTime = new Date(now);
            tab.hourReferenceStartTime.setMinutes(0, 0, 0);
        }

        log.info(
            'Stundenreferenz aktualisiert: ' +
            getHourLabel(actualHour) +
            ' ab ' + formatTime(tab.hourReferenceStartTime)
        );
    }
    // =========================================================
    // VOLLE STUNDE / NÄCHSTE VOLLE STUNDE
    // =========================================================

    function processFullHour(tab) {

        if (!tab.startSnapshotPlayers || !tab.allianceName) {
            return;
        }

        // Die eigentliche Stundenumschaltung erfolgt in
        // reconcileCurrentHour() anhand der C&C-TA-Serverzeit.
        refreshCurrentActivity(tab);
    }

    function scheduleNextHour(tab) {

        if (tab.hourTimer) {
            clearTimeout(tab.hourTimer);
            tab.hourTimer = null;
        }

        const now = getGameServerDate();
        updateNextHourDisplay(tab, now);

        const next = new Date(now);
        next.setHours(now.getHours() + 1, 0, 0, 0);

        const delay = Math.max(1000, next.getTime() - now.getTime());

        tab.hourTimer = setTimeout(function () {

            tab.hourTimer = null;

            if (tab.startSnapshotPlayers && tab.allianceName) {
                refreshCurrentActivity(tab);
            }

            scheduleNextHour(tab);

        }, delay);

        log.info(
            'Reiter ' + (tab.index + 1) +
            ': nächste volle Stunde ' + formatTime(next)
        );
    }

    // =========================================================
    // 5-MINUTEN-AKTUALISIERUNG
    // =========================================================

    function startUpdateTimer(
    tab
    ) {

        if (tab.updateTimer) {
            clearInterval(
                tab.updateTimer
            );
        }

        if (tab.countdownTimer) {
            clearInterval(
                tab.countdownTimer
            );
        }

        // Der Countdown folgt exakt dem bestehenden 5-Minuten-Zyklus.
        tab.nextUpdateAt =
            Date.now() + UPDATE_INTERVAL;

        updateUpdateCountdown(tab);

        // Bestehender 5-Minuten-Zyklus – die eigentliche Messlogik
        // bleibt unverändert.
        tab.updateTimer =
            setInterval(
            function () {

                if (
                    tab.startSnapshotPlayers &&
                    tab.allianceName
                ) {
                    refreshCurrentActivity(
                        tab
                    );
                }

                // Nächsten 5-Minuten-Zyklus festlegen.
                tab.nextUpdateAt =
                    Date.now() + UPDATE_INTERVAL;

                updateUpdateCountdown(tab);

            },
            UPDATE_INTERVAL
        );

        // Nur die Anzeige wird jede Sekunde aktualisiert.
        tab.countdownTimer =
            setInterval(
            function () {
                updateUpdateCountdown(tab);
            },
            1000
        );
    }

    // =========================================================
    // AUTOMATISCHER SNAPSHOT
    // =========================================================

    function checkAutomaticSnapshot(
    tab
    ) {

        if (tab.index !== 0) {
            return;
        }

        // Die automatische Snapshot-Steuerung existiert nur auf Reiter 1.
        if (tab.index !== 0) {
            return;
        }

        if (!tab.automaticEnabled || !tab.allianceName) {
            return;
        }

        const configuredTime =
              tab.automaticTimeValue || '21:00';

        if (
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
                configuredTime
            )
        ) {

            return;
        }

        const now =
              getGameServerDate();

        // Nicht nur auf exakt eine Minute warten.
        // Der Timer kann durch den Browser/Spielbetrieb leicht verspätet
        // laufen. Sobald die eingestellte Uhrzeit erreicht/überschritten ist,
        // wird der Snapshot für diesen Tag ausgelöst.
        const currentMinutes =
              now.getHours() * 60 + now.getMinutes();

        const configuredParts =
              configuredTime.split(':');

        const configuredMinutes =
              Number(configuredParts[0]) * 60 +
              Number(configuredParts[1]);

        if (currentMinutes < configuredMinutes) {

            return;
        }

        const todayKey =
              now.getFullYear() +
              '-' +
              String(
                  now.getMonth() + 1
              ).padStart(2, '0') +
              '-' +
              String(
                  now.getDate()
              ).padStart(2, '0');

        // Wichtig: Der konfigurierte Zeitpunkt gehört zum Ausführungs-Schlüssel.
        // Wird die Automatik am selben Tag von z.B. 13:49 auf 20:30 geändert,
        // darf der neue Zeitpunkt nicht wegen des alten Tagesmerkers blockiert werden.
        const automaticSnapshotKey =
              todayKey + '_' + configuredTime;

        if (
            tab.lastAutomaticSnapshotDate ===
            automaticSnapshotKey
        ) {

            return;
        }

        // Solange der Snapshot noch auf Netzwerkantworten wartet, darf der
        // 30-Sekunden-Timer keinen zweiten Snapshot starten.
        if (tab.automaticSnapshotInProgress) {
            return;
        }

        tab.automaticSnapshotInProgress = true;

        log.section(
            'AUTOMATISCHER SNAPSHOT – REITER ' +
            (tab.index + 1)
        );

        // Erst alte Messrunde ungültig machen und Darstellung leeren. Dadurch
        // können auch bereits laufende 5-Minuten-Abfragen nicht mehr die alte
        // Tabelle zurückschreiben.
        tabs.forEach(function (trackedTab) {
            if (!trackedTab.allianceName) {
                return;
            }

            resetMeasurementDisplay(trackedTab, 'automatischer Snapshot');
        });

        // Den Tages/Zeit-Merker erst NACH erfolgreich abgeschlossenen
        // Snapshot-Anfragen setzen. Schlägt die Abfrage fehl, wird beim
        // nächsten 30-Sekunden-Check erneut versucht.
        performSnapshotAllTabs(
            'automatisch',
            function (success) {
                tab.automaticSnapshotInProgress = false;

                if (success) {
                    tab.lastAutomaticSnapshotDate = automaticSnapshotKey;
                    saveSettings();
                    log.success(
                        'Automatischer Snapshot erfolgreich abgeschlossen: ' +
                        automaticSnapshotKey
                    );
                } else {
                    log.warning(
                        'Automatischer Snapshot nicht vollständig erfolgreich. ' +
                        'Der Versuch wird beim nächsten Automatik-Check wiederholt.'
                    );
                }
            }
        );
    }

    // =========================================================
    // AUTOMATIK TIMER
    // =========================================================

    function startAutomaticTimer(tab) {

        if (tab.automaticTimer) {
            clearInterval(tab.automaticTimer);
        }

        if (tab.automaticDueTimer) {
            clearTimeout(tab.automaticDueTimer);
        }

        function scheduleExactAutomaticSnapshot() {
            if (!tab.automaticEnabled || !tab.allianceName) {
                return;
            }

            const configuredTime = tab.automaticTimeValue || '21:00';
            if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(configuredTime)) {
                return;
            }

            const now = new Date();
            const parts = configuredTime.split(':');
            const target = new Date(now);
            target.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
            if (target.getTime() <= now.getTime()) {
                target.setDate(target.getDate() + 1);
            }

            const delay = Math.max(1000, target.getTime() - now.getTime());
            tab.automaticDueTimer = setTimeout(function () {
                if (tab.automaticEnabled && tab.allianceName) {
                    checkAutomaticSnapshot(tab);
                }
                scheduleExactAutomaticSnapshot();
            }, delay);

            log.info('Reiter ' + (tab.index + 1) + ': automatischer Snapshot geplant für ' + configuredTime);
        }

        tab.automaticTimer = setInterval(function () {
            checkAutomaticSnapshot(tab);
        }, AUTO_CHECK_INTERVAL);

        scheduleExactAutomaticSnapshot();
    }

    // =========================================================
    // AKTUELLE STUNDENÄNDERUNG
    // =========================================================

    function getCurrentHourChange(
    tab,
     playerName,
     currentPoints
    ) {

        if (
            !tab.hourReferencePlayers
        ) {

            return 0;
        }

        const reference =
              tab.hourReferencePlayers[
                  playerName
              ];

        if (!reference) {

            return 0;
        }

        return (
            currentPoints -
            reference.points
        );
    }

    // =========================================================
    // ÄNDERUNG FORMATIEREN
    // =========================================================

    function formatChange(
    value
    ) {

        const number =
              Number(
                  value || 0
              );

        if (number > 0) {

            return (
                '+' +
                number.toLocaleString(
                    'de-DE'
                )
            );
        }

        if (number < 0) {

            return number.toLocaleString(
                'de-DE'
            );
        }

        return '0';
    }

    // =========================================================
    // STUNDENSPALTEN SICHTBARKEIT
    // =========================================================
    // Die QoX-Tabelle behält intern immer exakt 28 Spalten.
    // Wir ändern NICHT die Anzahl der Model-Spalten.
    //
    // Nicht gemessene Stunden werden nur im ColumnModel ausgeblendet.
    // Dadurch bleiben alle gespeicherten Messdaten erhalten und es kann
    // kein columnIdArr/columnNameArr-Längenfehler entstehen.

    function getVisibleMeasurementHours(tab) {

        if (!tab) {
            return [];
        }

        const hours = new Set();

        /*
     * Die Anzeige berücksichtigt ausschließlich den aktuellen
     * Messzyklus.
     *
     * Abgeschlossene Stunden werden nur dann eingeblendet,
     * wenn in dieser Stunde tatsächlich mindestens eine
     * Punkteveränderung festgestellt wurde.
     *
     * Die aktuelle Stunde wird immer angezeigt, damit die
     * laufende Messung sichtbar bleibt – auch wenn bisher
     * noch keine Punkteveränderung vorhanden ist.
     */

        let snapshotHour = null;

        const snapshotCandidates = [
            tab.startSnapshotTime,
            tab.snapshotTime,
            tab.snapshotTimestamp,
            tab.lastSnapshotTime,
            tab.lastSnapshotTimestamp
        ];

        for (
            let i = 0;
            i < snapshotCandidates.length;
            i++
        ) {

            const value =
                  snapshotCandidates[i];

            if (
                value instanceof Date &&
                !isNaN(value.getTime())
            ) {
                snapshotHour =
                    value.getHours();

                break;
            }

            if (
                typeof value === 'string'
            ) {

                const match =
                      value.match(
                          /(?:^|[ T])(\d{1,2}):\d{2}/
                      );

                if (match) {
                    snapshotHour =
                        Number(match[1]);

                    break;
                }
            }

            if (
                Number.isFinite(
                    Number(value)
                )
            ) {

                const numeric =
                      Number(value);

                if (
                    numeric >= 0 &&
                    numeric < 24
                ) {
                    snapshotHour =
                        numeric;

                    break;
                }

                // Unix-/JavaScript-Zeitstempel.
                if (
                    numeric > 1000000000
                ) {

                    const date =
                          new Date(numeric);

                    if (
                        !isNaN(
                            date.getTime()
                        )
                    ) {
                        snapshotHour =
                            date.getHours();

                        break;
                    }
                }
            }
        }

        /*
     * Fallback auf die gespeicherte erste Messstunde.
     */
        if (
            snapshotHour === null &&
            Number.isInteger(
                tab.firstMeasurementHour
            )
        ) {
            snapshotHour =
                tab.firstMeasurementHour;
        }

        const currentHour =
              Number.isInteger(
                  tab.currentHourIndex
              )
        ? tab.currentHourIndex
        : null;

        /*
     * Prüft, ob eine abgeschlossene Stunde tatsächlich
     * eine Punkteveränderung enthält.
     *
     * 0     = keine Veränderung
     * null  = Spieler nicht mehr vorhanden / kein Wert
     * != 0  = tatsächliche Punkteveränderung
     */
        function hasRealPointChange(hourData) {

            if (
                !hourData ||
                typeof hourData !== 'object'
            ) {
                return false;
            }

            return Object.keys(hourData).some(
                function (playerName) {

                    const value =
                          hourData[playerName];

                    return (
                        typeof value === 'number' &&
                        Number.isFinite(value) &&
                        value !== 0
                    );
                }
            );
        }

        /*
     * Prüfen, ob eine Stunde zum aktuellen Messzyklus gehört.
     *
     * Beispiel:
     * Snapshot 14 Uhr
     * aktuelle Stunde 10 Uhr
     *
     * gültiger Bereich:
     * 14-23 und 00-10
     */
        function isHourInCurrentCycle(hour) {

            if (
                snapshotHour === null ||
                currentHour === null
            ) {
                return true;
            }

            const distance =
                  (
                      hour -
                      snapshotHour +
                      24
                  ) % 24;

            const currentDistance =
                  (
                      currentHour -
                      snapshotHour +
                      24
                  ) % 24;

            return distance <= currentDistance;
        }

        const completed =
              tab.completedHours || [];

        /*
     * Bereits abgeschlossene Stunden:
     * Nur Stunden mit mindestens einer echten
     * Punkteveränderung werden sichtbar.
     */
        Object.keys(completed).forEach(
            function (key) {

                const hour =
                      Number(key);

                if (
                    !Number.isInteger(hour) ||
                    hour < 0 ||
                    hour > 23
                ) {
                    return;
                }

                if (
                    !isHourInCurrentCycle(hour)
                ) {
                    return;
                }

                if (
                    hasRealPointChange(
                        completed[hour]
                    )
                ) {
                    hours.add(hour);
                }
            }
        );

        /*
     * Die aktuell laufende Stunde bleibt immer sichtbar.
     */
        if (
            currentHour !== null &&
            tab.windowOpen &&
            (
                snapshotHour === null ||
                isHourInCurrentCycle(currentHour)
            )
        ) {
            hours.add(currentHour);
        }

        /*
     * Numerisch sortieren.
     *
     * Dadurch stehen die Stunden nach Mitternacht
     * zunächst bei 00-xx und die Stunden des Vortages
     * danach.
     *
     * Beispiel:
     * 06,07,08,09,10,11,14,15,...,21
     */
        return Array.from(hours).sort(
            function (a, b) {
                return a - b;
            }
        );
    }

    function resizeActivityWindow(visibleHourCount, rowCount, tab) {

        if (!activityWindow) {
            return;
        }

        /*
         * Breite:
         *   Rang + Spieler + Snapshot + Stunden + etwas Rand
         *
         * Mindestbreite 1000 px, damit die Bedienelemente im Kopf
         * nicht unnötig zusammengedrückt werden.
         *
         * 1580 px bleibt die bisherige maximale Größe.
         */
        const hourWidth = 68;
        const fixedWidth = 45 + 135 + 100 + 100;
        const windowPadding = 40;

        const calculatedWidth =
              fixedWidth +
              (visibleHourCount * hourWidth) +
              windowPadding;

        const width =
              Math.max(
                  1000,
                  Math.min(
                      1580,
                      calculatedWidth
                  )
              );

        /*
         * Höhe:
         * Bei wenigen Spielern wird das Fenster kleiner.
         * Bei vielen Spielern bleibt die bisherige Maximalhöhe von 650 px.
         */
        const rowHeight = 20;
        const headerAndControls = 210;

        const calculatedHeight =
              headerAndControls +
              Math.min(
                  Math.max(
                      Number(rowCount) || 0,
                      1
                  ),
                  22
              ) * rowHeight;

        const height =
              Math.max(
                  400,
                  Math.min(
                      650,
                      calculatedHeight
                  )
              );

        try {
            activityWindow.set({
                width: width,
                height: height
            });
        } catch (e) {

            try {
                activityWindow.setWidth(
                    width
                );

                activityWindow.setHeight(
                    height
                );
            } catch (ignore) {}
        }

        // Das Fenster hat jetzt seine endgültige Breite. Die letzte
        // Puffer-Spalte füllt exakt den verbleibenden Bereich aus.
        try {

            if (
                tab &&
                tab.columnModel
            ) {

                const fixedWidth =
                      45 +
                      135 +
                      100;

                const hourWidth =
                      68;

                const usedWidth =
                      fixedWidth +
                      (visibleHourCount * hourWidth) +
                      8;

                const remaining =
                      width -
                      usedWidth;

                tab.columnModel.setColumnWidth(
                    3 + visibleHourCount,
                    Math.max(
                        100,
                        remaining
                    )
                );
            }

        } catch (e) {}
    }

    function rebuildDynamicTable(tab, visibleHours, rows) {

        if (!tab || !tab.page) {
            return;
        }

        const oldTable =
              tab.table || null;

        const columns = [
            currentLanguage === 'en'
            ? 'Rank'
            : currentLanguage === 'fr'
            ? 'Rang'
            : currentLanguage === 'es'
            ? 'Rango'
            : 'Rang',

            currentLanguage === 'en'
            ? 'Player'
            : currentLanguage === 'fr'
            ? 'Joueur'
            : currentLanguage === 'es'
            ? 'Jugador'
            : 'Spieler',

            'Snapshot'
        ];

        visibleHours.forEach(
            function (hour) {
                columns.push(
                    getHourLabel(hour)
                );
            }
        );

        // Kleine Puffer-Spalte am Ende.
        columns.push('');

        const model =
              new qx.ui.table.model.Simple();

        model.setColumns(
            columns
        );

        model.setData(
            rows
        );

        const newTable =
              new qx.ui.table.Table(
                  model
              );

        newTable.set({
            height: 420,
            decorator: 'main',
            showCellFocusIndicator: false,
            backgroundColor: '#202830'
        });

        const newColumnModel =
              newTable.getTableColumnModel();

        // Die drei Grundspalten bleiben beim horizontalen Scrollen stehen.
        try {
            if (
                typeof newColumnModel.setFrozenColumns ===
                'function'
            ) {
                newColumnModel.setFrozenColumns(3);
            }
        } catch (e) {}

        // Grundbreiten.
        newColumnModel.setColumnWidth(0, 45);
        newColumnModel.setColumnWidth(1, 135);
        newColumnModel.setColumnWidth(2, 100);

        // Individuelle Breiten aus den alten festen Stundenpositionen
        // übernehmen: Stunde 09 = alte Spalte 12 usw.
        visibleHours.forEach(
            function (hour, index) {

                let width = 68;

                if (
                    tab.columnWidths &&
                    Number.isFinite(
                        Number(
                            tab.columnWidths[3 + hour]
                        )
                    )
                ) {

                    const saved =
                          Number(
                              tab.columnWidths[3 + hour]
                          );

                    if (
                        saved >= 35 &&
                        saved <= 300
                    ) {
                        width = saved;
                    }
                }

                newColumnModel.setColumnWidth(
                    3 + index,
                    width
                );
            }
        );

        // Puffer-Spalte.
        // Die Breite wird nach dem Setzen der Fenstergröße dynamisch
        // auf den verbleibenden Platz erweitert.
        newColumnModel.setColumnWidth(
            3 + visibleHours.length,
            100
        );

        const TABLE_CELL_BG =
              '#202830';

        const TABLE_TEXT =
              '#dbe5ec';

        const TABLE_GRID =
              '#39454f';

        const defaultRenderer =
              new qx.ui.table.cellrenderer.Default();

        defaultRenderer._getCellStyle =
            function (cellInfo) {

            return [
                'background-color:' + TABLE_CELL_BG,
                'color:' + TABLE_TEXT,
                'border-color:' + TABLE_GRID
            ].join(';') + ';';
        };

        for (
            let col = 0;
            col < 3;
            col++
        ) {
            newColumnModel.setDataCellRenderer(
                col,
                defaultRenderer
            );
        }

        const hourRenderer =
              new qx.ui.table.cellrenderer.Default();

        hourRenderer._getCellStyle =
            function (cellInfo) {

            const value =
                  String(
                      cellInfo.value || ''
                  );

            if (
                value.charAt(0) === '+'
            ) {

                return [
                    'color:#00cc66',
                    'font-weight:bold',
                    'text-align:center',
                    'font-size:' + hourFontSize + 'px',
                    'background-color:' + TABLE_CELL_BG,
                    'border-color:' + TABLE_GRID
                ].join(';') + ';';
            }

            if (
                value.charAt(0) === '-'
            ) {

                return [
                    'color:#ff4444',
                    'font-weight:bold',
                    'text-align:center',
                    'font-size:' + hourFontSize + 'px',
                    'background-color:' + TABLE_CELL_BG,
                    'border-color:' + TABLE_GRID
                ].join(';') + ';';
            }

            return [
                'color:' + TABLE_TEXT,
                'text-align:center',
                'font-size:' + hourFontSize + 'px',
                'background-color:' + TABLE_CELL_BG,
                'border-color:' + TABLE_GRID
            ].join(';') + ';';
        };

        for (
            let col = 3;
            col < 3 + visibleHours.length;
            col++
        ) {

            newColumnModel.setDataCellRenderer(
                col,
                hourRenderer
            );
        }

        // Puffer dunkel darstellen.
        newColumnModel.setDataCellRenderer(
            3 + visibleHours.length,
            defaultRenderer
        );

        // Der freie Bereich rechts wird über die letzte Puffer-Spalte
        // gefüllt. Das ist bei dieser QoX-Tabelle zuverlässiger als
        // die Pane-Hintergründe zu verändern.

        // Die Tabelle sitzt in einem eigenen Container.
        // Dadurch wird beim dynamischen Wechsel garantiert nur die Tabelle
        // ersetzt und nicht das restliche Dashboard.
        const tableContainer =
              tab.tableContainer;

        if (!tableContainer) {
            return;
        }

        try {

            if (oldTable) {
                try {
                    tableContainer.remove(
                        oldTable
                    );
                } catch (removeError) {}
            }

            tableContainer.add(
                newTable,
                {
                    flex: 1
                }
            );

        } catch (e) {
            return;
        }

        tab.tableModel =
            model;

        tab.table =
            newTable;

        tab.columnModel =
            newColumnModel;

        tab.hourChangeRenderer =
            hourRenderer;

        tab.visibleHoursKey =
            visibleHours.join(',');

        // Fenstergröße an die tatsächlich vorhandenen Stunden und Spieler
        // anpassen. 1580 x 650 bleibt die Obergrenze.
        resizeActivityWindow(
            visibleHours.length,
            rows.length,
            tab
        );

        // Die manuelle Breitenfunktion für die tatsächlich vorhandenen
        // Spalten neu installieren.
        installManualColumnResize(
            tab
        );

        // Änderungen an Spaltenbreiten speichern.
        newColumnModel.addListener(
            'widthChanged',
            function () {

                if (tab.columnSaveTimer) {
                    clearTimeout(
                        tab.columnSaveTimer
                    );
                }

                tab.columnSaveTimer =
                    setTimeout(
                    function () {

                        tab.columnSaveTimer =
                            null;

                        // Breiten der dynamischen Stunden wieder
                        // auf ihre ursprünglichen Stundenpositionen
                        // abbilden.
                        if (!tab.columnWidths) {
                            tab.columnWidths =
                                Array.from(
                                { length: 28 },
                                function () {
                                    return 68;
                                }
                            );

                            tab.columnWidths[0] =
                                45;

                            tab.columnWidths[1] =
                                135;

                            tab.columnWidths[2] =
                                100;

                            tab.columnWidths[27] =
                                100;
                        }

                        visibleHours.forEach(
                            function (hour, index) {

                                try {
                                    tab.columnWidths[
                                        3 + hour
                                    ] =
                                        newColumnModel.getColumnWidth(
                                        3 + index
                                    );
                                } catch (e) {}
                            }
                        );

                        saveSettings();

                    },
                    300
                );
            }
        );
    }

    // =========================================================
    // TABELLE AKTUALISIEREN
    // =========================================================

    function updateTable(
    tab,
     players
    ) {

        if (
            !tab.windowOpen ||
            !tab.startSnapshotPlayers
        ) {
            return;
        }

        const visibleHours =
              getVisibleMeasurementHours(tab);

        const rows = [];

        players.forEach(
            function (player) {

                if (
                    !player ||
                    !player.pn
                ) {
                    return;
                }

                const name =
                      player.pn;

                const snapshotPlayer =
                      tab.startSnapshotPlayers[
                          name
                      ];

                if (!snapshotPlayer) {
                    return;
                }

                const row = [

                    Number(
                        player.r || 0
                    ),

                    name,

                    snapshotPlayer.points
                    .toLocaleString(
                        'de-DE'
                    )
                ];

                visibleHours.forEach(
                    function (hour) {

                        if (
                            tab.completedHours[
                                hour
                            ] &&
                            Object.prototype
                            .hasOwnProperty.call(
                                tab.completedHours[
                                    hour
                                ],
                                name
                            )
                        ) {

                            row.push(
                                formatChange(
                                    tab.completedHours[
                                        hour
                                    ][name]
                                )
                            );

                        } else if (
                            hour ===
                            tab.currentHourIndex
                        ) {

                            const change =
                                  getCurrentHourChange(
                                      tab,
                                      name,
                                      Number(
                                          player.s || 0
                                      )
                                  );

                            row.push(
                                formatChange(
                                    change
                                )
                            );

                        } else {

                            row.push('');
                        }
                    }
                );

                // Puffer-Zelle.
                row.push('');

                rows.push(
                    row
                );
            }
        );

        const newKey =
              visibleHours.join(',');

        // Noch keine Messstunde vorhanden:
        // keine dynamische Stunde anzeigen.
        // Sobald die erste Messung vorliegt, wird die Tabelle komplett
        // mit genau dieser ersten Stunde aufgebaut.
        if (visibleHours.length === 0) {
            return;
        }

        // Nur wenn sich die tatsächlich vorhandenen Stunden geändert haben,
        // wird die Tabelle neu aufgebaut. Bei normalen 5-Minuten-Checks wird
        // lediglich das bestehende Model aktualisiert.
        if (
            !tab.tableModel ||
            !tab.table ||
            tab.visibleHoursKey !== newKey
        ) {

            rebuildDynamicTable(
                tab,
                visibleHours,
                rows
            );

        } else {

            tab.tableModel.setData(
                rows
            );

            resizeActivityWindow(
                visibleHours.length,
                rows.length,
                tab
            );
        }
    }

    // =========================================================
    // 5-MINUTEN-COUNTDOWN
    // =========================================================

    function formatCountdown(ms) {

        const totalSeconds =
              Math.max(
                  0,
                  Math.ceil(ms / 1000)
              );

        const minutes =
              Math.floor(
                  totalSeconds / 60
              );

        const seconds =
              totalSeconds % 60;

        return (
            String(minutes).padStart(2, '0') +
            ':' +
            String(seconds).padStart(2, '0')
        );
    }

    function updateUpdateCountdown(tab) {

        if (!tab || !tab.updateCountdownLabel) {
            return;
        }

        if (!tab.nextUpdateAt) {
            tab.updateCountdownLabel.setValue(
                t('nextUpdate') + '05:00'
            );
            return;
        }

        const remaining =
              Math.max(
                  0,
                  tab.nextUpdateAt - Date.now()
              );

        tab.updateCountdownLabel.setValue(
            t('nextUpdate') +
            formatCountdown(remaining)
        );
    }

    // =========================================================
    // STATUS
    // =========================================================

    function updateStatus(
    tab
    ) {

        if (!tab.windowOpen || !tab.snapshotLabel || !tab.statusLabel) {
            return;
        }

        if (
            !tab.startSnapshotTime
        ) {

            tab.snapshotLabel.setValue(
                t('snapshotNone')
            );

            tab.statusLabel.setValue(
                t('noMeasurement')
            );

            return;
        }

        tab.snapshotLabel.setValue(
            t('snapshotNone').replace(/[:：].*$/, ': ') +
            formatTime(
                tab.startSnapshotTime
            )
        );

        tab.statusLabel.setValue(
            t('measurementActive') +
            getHourLabel(tab.currentHourIndex)
        );
    }

    // =========================================================
    // SPRACHE AUF ALLE REITER ANWENDEN
    // =========================================================

    function updateAutomaticStatus(tab) {

        if (!tab || !tab.automaticStatusLabel) return;

        const isActive = tab.automaticCheckBox && tab.automaticCheckBox.getValue();
        const time = tab.automaticTimeField ? tab.automaticTimeField.getValue() : '';
        const word = isActive
        ? t('automaticActiveWord')
        : t('automaticInactiveWord');
        const prefix = t('automaticPrefix');
        const color = isActive ? '#00cc66' : '#ff3333';

        tab.automaticStatusLabel.setRich(true);
        tab.automaticStatusLabel.setValue(
            prefix + '<span style="color:' + color + ';font-weight:bold;">' +
            word + '</span>' +
            (isActive ? ' – ' + time : '')
        );
    }

    function updateLanguage() {

        tabs.forEach(function (tab) {

            if (tab.page && tab.page.setLabel) {
                tab.page.setLabel(
                    t('tab') + ' ' + (tab.index + 1)
                );
            }

            if (tab.allianceLabel) {
                tab.allianceLabel.setValue(t('alliance'));
            }

            if (tab.snapshotButton) {
                tab.snapshotButton.setLabel(t('snapshotNow'));
            }

            if (tab.snapshotLabel) {
                updateStatus(tab);
            }

            if (tab.nextCheckLabel) {
                if (tab.nextHourTime) {
                    tab.nextCheckLabel.setValue(
                        t('nextHour') + ' ' + formatTime(tab.nextHourTime)
                    );
                } else {
                    tab.nextCheckLabel.setValue(
                        t('nextHour') + ' –'
                    );
                }
            }

            if (tab.automaticCheckBox) {
                tab.automaticCheckBox.setLabel(t('automaticSnapshot'));
            }

            if (tab.automaticTimeLabel) {
                tab.automaticTimeLabel.setValue(t('time'));
            }

            if (tab.automaticSaveButton) {
                tab.automaticSaveButton.setLabel(t('save'));
            }

            if (tab.automaticStatusLabel) {
                updateAutomaticStatus(tab);
            }

            if (tab.languageLabel) {
                tab.languageLabel.setValue(t('language'));
            }

            if (tab.pointSizeLabel) {
                tab.pointSizeLabel.setValue(t('pointSize'));
            }

            if (tab.pointSizeSelect) {
                const selection = tab.pointSizeSelect.getSelection();
                if (selection && selection.length) {
                    // Auswahl bleibt bestehen; nur die Beschriftung wird bei Sprachwechsel aktualisiert.
                }
            }
        });
    }

    // =========================================================
    // MANUELLE SPALTENBREITEN
    // =========================================================

    function installManualColumnResize(tab) {

        try {

            const table = tab.table;
            const columnModel = tab.columnModel;

            if (!table || !columnModel) {
                return;
            }

            const scroller =
                  table.getPaneScroller(0);

            if (!scroller || !scroller.getHeader) {
                log.warning(
                    'Tab ' + (tab.index + 1) + ': Tabellenkopf für Spaltenbreiten nicht gefunden.'
                );
                return;
            }

            const header = scroller.getHeader();

            if (!header || !header.getHeaderWidgetAtColumn) {
                log.warning(
                    'Tab ' + (tab.index + 1) + ': Header unterstützt keine Spaltenabfrage.'
                );
                return;
            }

            const MIN_WIDTH = 35;
            const MAX_WIDTH = 300;
            const EDGE = 6;

            const columnCount = columnModel.getColumnCount
            ? columnModel.getColumnCount()
            : 0;

            for (let col = 0; col < columnCount; col++) {

                const cell =
                      header.getHeaderWidgetAtColumn(col);

                if (!cell || !cell.getContentElement) {
                    continue;
                }

                const dom =
                      cell.getContentElement().getDomElement();

                if (!dom) {
                    continue;
                }

                // Mehrfachinstallation vermeiden.
                if (dom.dataset && dom.dataset.harziResizeInstalled === '1') {
                    continue;
                }

                if (dom.dataset) {
                    dom.dataset.harziResizeInstalled = '1';
                }

                dom.addEventListener(
                    'mousemove',
                    function (event) {

                        const rect = dom.getBoundingClientRect();
                        const nearRightEdge =
                              event.clientX >= rect.right - EDGE;

                        dom.style.cursor =
                            nearRightEdge
                            ? 'col-resize'
                        : '';
                    }
                );

                dom.addEventListener(
                    'mousedown',
                    function (event) {

                        const rect = dom.getBoundingClientRect();

                        if (event.clientX < rect.right - EDGE) {
                            return;
                        }

                        event.preventDefault();
                        event.stopPropagation();

                        const startX = event.clientX;
                        const startWidth =
                              columnModel.getColumnWidth(col);

                        const onMove =
                              function (moveEvent) {

                                  const delta =
                                        moveEvent.clientX - startX;

                                  const newWidth =
                                        Math.max(
                                            MIN_WIDTH,
                                            Math.min(
                                                MAX_WIDTH,
                                                startWidth + delta
                                            )
                                        );

                                  columnModel.setColumnWidth(
                                      col,
                                      newWidth
                                  );
                              };

                        const onUp =
                              function () {

                                  document.removeEventListener(
                                      'mousemove',
                                      onMove
                                  );

                                  document.removeEventListener(
                                      'mouseup',
                                      onUp
                                  );

                                  if (tab.columnSaveTimer) {
                                      clearTimeout(
                                          tab.columnSaveTimer
                                      );
                                  }

                                  tab.columnSaveTimer =
                                      setTimeout(
                                      function () {
                                          tab.columnSaveTimer = null;
                                          saveSettings();
                                      },
                                      100
                                  );
                              };

                        document.addEventListener(
                            'mousemove',
                            onMove
                        );

                        document.addEventListener(
                            'mouseup',
                            onUp
                        );
                    }
                );
            }

            log.success(
                'Tab ' +
                (tab.index + 1) +
                ': manuelle Spaltenbreiten aktiviert.'
            );

        } catch (e) {

            log.error(
                'Fehler beim Aktivieren der manuellen Spaltenbreiten:',
                e
            );
        }
    }

    // =========================================================
    // TAB ERSTELLEN
    // =========================================================

    function createTab(
    index,
     alliances,
     settings
    ) {

        const page =
              new qx.ui.tabview.Page(
                  t('tab') + ' ' +
                  (index + 1)
              );

        page.setLayout(
            new qx.ui.layout.VBox(
                6
            )
        );

        // -----------------------------------------------------
        // DASHBOARD – stärker segmentiertes, modernes Grundlayout
        // -----------------------------------------------------


        // -----------------------------------------------------
        // KOPFZEILE – AUSWAHL / KOMFORTFUNKTIONEN
        // -----------------------------------------------------

        const header1 =
              new qx.ui.container.Composite(
                  new qx.ui.layout.HBox(
                      8
                  )
              );

        const allianceLabel =
              new qx.ui.basic.Label(
                  t('alliance')
              );

        allianceLabel.set({
            textColor: '#ffff00',
            font: 'bold'
        });

        const allianceSelect =
              new qx.ui.form.SelectBox();

        allianceSelect.set({
            width: 200,
            height: 26
        });

        alliances.forEach(
            function (alliance) {

                const item =
                      new qx.ui.form.ListItem(
                          alliance.r +
                          '. ' +
                          alliance.an
                      );

                item.setUserData(
                    'allianceName',
                    alliance.an
                );

                allianceSelect.add(item);
            }
        );

        header1.add(allianceLabel);
        header1.add(allianceSelect);

        let languageLabel = null;
        let languageSelect = null;
        let pointSizeLabel = null;
        let pointSizeSelect = null;

        if (index === 0) {

            languageLabel =
                new qx.ui.basic.Label(
                t('language')
            );

            languageLabel.set({
                textColor: '#ffff00',
                font: 'bold'
            });

            languageSelect =
                new qx.ui.form.SelectBox();

            languageSelect.set({
                width: 105,
                height: 26
            });

            Object.keys(LANGUAGES).forEach(function (code) {

                const item =
                      new qx.ui.form.ListItem(
                          LANGUAGES[code].name
                      );

                item.setUserData(
                    'languageCode',
                    code
                );

                languageSelect.add(item);
            });

            header1.add(languageLabel);
            header1.add(languageSelect);

            // Komfortfunktion: Schriftgröße der Punkteentwicklung
            pointSizeLabel =
                new qx.ui.basic.Label(
                t('pointSize')
            );

            pointSizeLabel.set({
                textColor: '#ffff00',
                font: 'bold'
            });

            pointSizeSelect =
                new qx.ui.form.SelectBox();

            pointSizeSelect.set({
                width: 55,
                height: 26
            });

            [9, 10, 11, 12].forEach(function (size) {

                const item =
                      new qx.ui.form.ListItem(
                          String(size)
                      );

                item.setUserData(
                    'fontSize',
                    size
                );

                pointSizeSelect.add(item);
            });

            header1.add(pointSizeLabel);
            header1.add(pointSizeSelect);
        }

        header1.add(
            new qx.ui.core.Spacer(),
            {
                flex: 1
            }
        );

        // -----------------------------------------------------
        // LAYOUT: DASHBOARD
        // -----------------------------------------------------
        header1.set({
            backgroundColor: '#121a24',
            padding: 8
        });


        page.set({
            backgroundColor: '#0b1118'
        });

        allianceLabel.set({
            textColor: '#6fc3ff',
            font: 'bold'
        });

        if (languageLabel) {
            languageLabel.set({
                textColor: '#7bdcff',
                font: 'bold'
            });
        }

        if (pointSizeLabel) {
            pointSizeLabel.set({
                textColor: '#8fe0ff',
                font: 'bold'
            });
        }

        page.add(header1);

        // -----------------------------------------------------
        // SNAPSHOT-FUNKTIONEN – EINE REIHE
        // -----------------------------------------------------

        const header2 =
              new qx.ui.container.Composite(
                  new qx.ui.layout.HBox(
                      8
                  )
              );

        header2.set({
            backgroundColor: '#101820',
            padding: 8
        });

        const snapshotButton =
              new qx.ui.form.Button(
                  t('snapshotNow')
              );

        snapshotButton.set({
            width: 120,
            height: 26
        });

        const snapshotLabel =
              new qx.ui.basic.Label(
                  t('snapshotNone')
              );

        snapshotLabel.set({
            textColor: '#ffff00'
        });

        const nextCheckLabel =
              new qx.ui.basic.Label(
                  t('nextHour') + ' –'
              );

        nextCheckLabel.set({
            textColor: '#ffff00'
        });

        header2.add(snapshotButton);
        header2.add(snapshotLabel);
        header2.add(nextCheckLabel);

        // -----------------------------------------------------
        // AUTOMATIK – NUR AUF REITER 1
        // -----------------------------------------------------

        let automaticCheckBox = null;
        let automaticTimeField = null;
        let automaticSaveButton = null;
        let automaticStatusLabel = null;
        let automaticTimeLabel = null;

        if (index === 0) {

            automaticCheckBox =
                new qx.ui.form.CheckBox(
                t('automaticSnapshot')
            );

            automaticTimeField =
                new qx.ui.form.TextField(
                '21:00'
            );

            automaticTimeField.set({
                width: 60,
                height: 24
            });

            automaticSaveButton =
                new qx.ui.form.Button(
                t('save')
            );

            automaticSaveButton.set({
                width: 80,
                height: 24
            });

            automaticStatusLabel =
                new qx.ui.basic.Label(
                t('automaticInactive')
            );

            automaticStatusLabel.set({
                textColor: '#ffffff'
            });
            automaticStatusLabel.setRich(true);

            automaticTimeLabel =
                new qx.ui.basic.Label(
                t('time')
            );

            header2.add(automaticCheckBox);
            header2.add(automaticTimeLabel);
            header2.add(automaticTimeField);
            header2.add(automaticSaveButton);
            header2.add(
                automaticStatusLabel,
                {
                    flex: 1
                }
            );
        } else {

            header2.add(
                new qx.ui.core.Spacer(),
                {
                    flex: 1
                }
            );
        }

        // Dashboard: Snapshot-/Automatik-Zeile stärker hervorheben
        snapshotButton.set({
            width: 125,
            height: 28
        });

        snapshotLabel.set({
            textColor: '#e5f4ff',
            font: 'bold'
        });

        nextCheckLabel.set({
            textColor: '#e5f4ff',
            font: 'bold'
        });

        if (automaticStatusLabel) {
            automaticStatusLabel.set({
                textColor: '#e5f4ff',
                font: 'bold'
            });
        }

        // Lesbarkeit der Automatik-Beschriftungen verbessern.
        // Checkbox-Label und Uhrzeit sollen auf dem dunklen Dashboard
        // deutlich sichtbar sein.
        if (automaticCheckBox) {
            try {
                const automaticCheckLabel =
                      automaticCheckBox.getChildControl('label');
                if (automaticCheckLabel) {
                    automaticCheckLabel.set({
                        textColor: '#dbe5ec',
                        font: 'bold'
                    });
                }
            } catch (checkboxLabelError) {
                log.warning(
                    'Checkbox-Beschriftung konnte nicht formatiert werden.',
                    checkboxLabelError
                );
            }
        }

        if (automaticTimeLabel) {
            automaticTimeLabel.set({
                textColor: '#dbe5ec',
                font: 'bold'
            });
        }

        page.add(header2);

        // -----------------------------------------------------
        // TABELLENSPALTEN
        // -----------------------------------------------------

        const columns = [
            currentLanguage === 'en' ? 'Rank' : currentLanguage === 'fr' ? 'Rang' : currentLanguage === 'es' ? 'Rango' : 'Rang',
            currentLanguage === 'en' ? 'Player' : currentLanguage === 'fr' ? 'Joueur' : currentLanguage === 'es' ? 'Jugador' : 'Spieler',
            'Snapshot'
        ];

        for (
            let hour = 0;
            hour < 24;
            hour++
        ) {

            columns.push(
                getHourLabel(
                    hour
                )
            );
        }

        // Leere Puffer-Spalte hinter 23-00. Sie füllt den freien Bereich
        // bis zum vertikalen Scrollbalken aus.
        columns.push('');

        const tableModel =
              new qx.ui.table.model.Simple();

        tableModel.setColumns(
            columns
        );

        // Das C&C-TA-qx-Build enthält keine verwendbare
        // qx.ui.table.columnmodel.Resize-Klasse.
        // Deshalb verwenden wir das normale ColumnModel und
        // implementieren das Ziehen der Spaltenbreiten selbst.
        const table =
              new qx.ui.table.Table(
                  tableModel
              );

        table.set({
            height: 420,
            decorator: 'main',
            showCellFocusIndicator: false
        });
        table.set({
            backgroundColor: '#0b1118'
        });


        const columnModel =
              table.getTableColumnModel();

        // Rang / Spieler / Snapshot bleiben beim horizontalen Scrollen sichtbar.
        try {
            if (
                columnModel &&
                typeof columnModel.setFrozenColumns === 'function'
            ) {
                columnModel.setFrozenColumns(3);
            }
        } catch (e) {}

        // -----------------------------------------------------
        // DARK TABLE – NUR DER INNERE TABELLENBEREICH
        // -----------------------------------------------------
        // Das Dashboard außerhalb der Tabelle bleibt unverändert.
        // Die qx-Tabelle zeichnet den hellen Hintergrund über eigene
        // Pane-/Zellen-Renderer. Deshalb werden ausschließlich diese
        // Komponenten dunkel gestaltet.
        const TABLE_BODY_BG = '#202830';
        const TABLE_CELL_BG = '#202830';
        const TABLE_TEXT = '#dbe5ec';
        const TABLE_GRID = '#39454f';

        try {
            table.set({
                backgroundColor: TABLE_BODY_BG
            });

            const paneScroller = table.getPaneScroller(0);

            if (paneScroller) {
                paneScroller.set({
                    backgroundColor: TABLE_BODY_BG
                });

                if (paneScroller.getChildControl) {
                    const pane = paneScroller.getChildControl('pane');
                    if (pane) {
                        pane.set({
                            backgroundColor: TABLE_BODY_BG
                        });
                    }

                    // Der Bereich rechts neben der letzten Spalte besteht in dieser
                    // qx-Version aus mehreren verschachtelten Widgets. Das
                    // Setzen der Widget-Farbe allein reicht nicht immer aus,
                    // weil der Content-Element-Hintergrund separat gezeichnet
                    // werden kann. Deshalb setzen wir beides.
                    try {
                        if (paneScroller.getContentElement) {
                            paneScroller.getContentElement().setStyle(
                                'background-color',
                                TABLE_BODY_BG
                            );
                        }
                    } catch (contentError) {}

                    ['scrollbar-y', 'verticalScrollBar'].forEach(function (controlId) {
                        try {
                            const scrollBar = paneScroller.getChildControl(controlId);
                            if (scrollBar) {
                                scrollBar.set({
                                    backgroundColor: TABLE_BODY_BG
                                });

                                try {
                                    if (scrollBar.getContentElement) {
                                        scrollBar.getContentElement().setStyle(
                                            'background-color',
                                            TABLE_BODY_BG
                                        );
                                    }
                                } catch (scrollBarContentError) {}
                            }
                        } catch (scrollBarError) {
                            // Control existiert in dieser qx-Version nicht.
                        }
                    });

                    // qx kann für den freien Streifen neben der letzten
                    // Spalte ein separates Child-Widget verwenden. Wir
                    // färben deshalb alle direkten/verschachtelten Widgets
                    // dieses Pane-Scrollers, ohne deren Layout oder Größe
                    // zu verändern.
                    const paintDark = function (widget) {
                        if (!widget) {
                            return;
                        }

                        try {
                            widget.set({
                                backgroundColor: TABLE_BODY_BG
                            });
                        } catch (widgetStyleError) {}

                        try {
                            if (widget.getContentElement) {
                                widget.getContentElement().setStyle(
                                    'background-color',
                                    TABLE_BODY_BG
                                );
                            }
                        } catch (widgetContentError) {}

                        try {
                            if (widget.getChildren) {
                                widget.getChildren().forEach(paintDark);
                            }
                        } catch (childrenError) {}
                    };

                    paintDark(paneScroller);
                }
            }
        } catch (darkPaneError) {
            log.warning(
                'Dunkler Tabellenbereich konnte nicht vollständig gesetzt werden.',
                darkPaneError
            );
        }

        const defaultCellRenderer =
              new qx.ui.table.cellrenderer.Default();

        const originalDefaultCellStyle =
              defaultCellRenderer._getCellStyle;

        defaultCellRenderer._getCellStyle =
            function (cellInfo) {
            const baseStyle =
                  originalDefaultCellStyle
            ? originalDefaultCellStyle.call(this, cellInfo)
            : '';

            return baseStyle +
                'background-color:' + TABLE_CELL_BG + ';' +
                'color:' + TABLE_TEXT + ';' +
                'border-color:' + TABLE_GRID + ';';
        };

        // Rang / Spieler / Snapshot dunkel darstellen.
        for (let col = 0; col < 3; col++) {
            columnModel.setDataCellRenderer(
                col,
                defaultCellRenderer
            );
        }

        // Puffer-Spalte dunkel darstellen.
        columnModel.setDataCellRenderer(
            27,
            defaultCellRenderer
        );

        const defaultColumnWidths = [
            45,
            135,
            100
        ];

        for (
            let col = 3;
            col < 27;
            col++
        ) {
            defaultColumnWidths.push(68);
        }

        // Leere Puffer-Spalte hinter 23-00.
        defaultColumnWidths.push(100);

        const savedColumnWidths =
              settings &&
              settings.tabs &&
              settings.tabs[index] &&
              Array.isArray(settings.tabs[index].columnWidths)
        ? settings.tabs[index].columnWidths
        : null;

        for (
            let col = 0;
            col < 27;
            col++
        ) {
            const savedWidth =
                  savedColumnWidths &&
                  Number(savedColumnWidths[col]);

            const width =
                  Number.isFinite(savedWidth) &&
                  savedWidth >= 35 &&
                  savedWidth <= 300
            ? savedWidth
            : defaultColumnWidths[col];

            columnModel.setColumnWidth(
                col,
                width
            );
        }

        // -----------------------------------------------------
        // Farbige Stundenwerte
        // -----------------------------------------------------
        // Positive Änderung = grün
        // Negative Änderung = rot
        // Keine Änderung = schwarz
        // Die Stunden-Spalten erhalten eine großzügige Standardbreite,
        // damit auch bei 12 px Schriftgröße etwa 7–8 Stellen inklusive
        // Vorzeichen gut lesbar sind. Individuell gespeicherte Breiten
        // werden weiterhin unverändert übernommen.

        const hourChangeRenderer =
              new qx.ui.table.cellrenderer.Default();

        hourChangeRenderer._getCellStyle =
            function (cellInfo) {

            const value =
                  String(cellInfo.value || '');

            if (value.charAt(0) === '+') {

                return [
                    'color:#00cc66',
                    'font-weight:bold',
                    'text-align:center',
                    'font-size:' + hourFontSize + 'px'
                ].join(';') +
                    ';background-color:' + TABLE_CELL_BG + ';border-color:' + TABLE_GRID + ';';
            }

            if (value.charAt(0) === '-') {

                return [
                    'color:#ff4444',
                    'font-weight:bold',
                    'text-align:center',
                    'font-size:' + hourFontSize + 'px'
                ].join(';') +
                    ';background-color:' + TABLE_CELL_BG + ';border-color:' + TABLE_GRID + ';';
            }

            return [
                'color:' + TABLE_TEXT,
                'font-weight:normal',
                'text-align:center',
                'font-size:' + hourFontSize + 'px'
            ].join(';') +
                ';background-color:' + TABLE_CELL_BG + ';border-color:' + TABLE_GRID + ';';
        };

        for (
            let col = 3;
            col < 27;
            col++
        ) {

            columnModel.setDataCellRenderer(
                col,
                hourChangeRenderer
            );
        }

        // Eigener Container für die Tabelle.
        // Die Tabelle kann später innerhalb dieses Containers dynamisch
        // ausgetauscht werden, ohne das Dashboard-Layout anzufassen.
        const tableContainer =
              new qx.ui.container.Composite(
                  new qx.ui.layout.Grow()
              );

        tableContainer.set({
            backgroundColor: '#0b1118'
        });

        tableContainer.add(
            table,
            {
                flex: 1
            }
        );

        page.add(
            tableContainer,
            {
                flex: 1
            }
        );

        // Tabellen-Statuszeile (z. B. "49 rows") passend zum dunklen
        // Tabellenbereich gestalten und sauber vom unteren Status trennen.
        try {
            if (table.getChildControl) {
                const tableStatusBar = table.getChildControl('statusbar');
                if (tableStatusBar) {
                    tableStatusBar.set({
                        backgroundColor: '#111820',
                        textColor: '#dbe5ec',
                        height: 20
                    });
                }
            }
        } catch (statusBarError) {
            log.warning(
                'Tabellen-Statuszeile konnte nicht formatiert werden.',
                statusBarError
            );
        }

        // -----------------------------------------------------
        // STATUS
        // -----------------------------------------------------

        const statusLabel =
              new qx.ui.basic.Label(
                  t('noMeasurement')
              );

        statusLabel.set({
            textColor: '#ffff00'
        });

        statusLabel.set({
            textColor: '#9bdcff',
            font: 'bold',
            paddingTop: 2,
            paddingBottom: 2
        });

        // -----------------------------------------------------
        // UNTERE STATUSZEILE
        // -----------------------------------------------------
        // Status und 5-Minuten-Countdown bleiben in EINER Zeile,
        // damit die Fensterhöhe unverändert bleibt.
        const statusFooter =
              new qx.ui.container.Composite(
                  new qx.ui.layout.HBox(12)
              );

        statusFooter.set({
            paddingTop: 2,
            paddingBottom: 2
        });

        const updateCountdownLabel =
              new qx.ui.basic.Label(
                  t('nextUpdate') + '05:00'
              );

        updateCountdownLabel.set({
            textColor: '#9bdcff',
            font: 'bold',
            paddingTop: 2,
            paddingBottom: 2
        });

        statusFooter.add(
            statusLabel,
            {
                flex: 1
            }
        );

        statusFooter.add(
            updateCountdownLabel
        );

        page.add(
            statusFooter
        );

        // -----------------------------------------------------
        // TAB-OBJEKT
        // -----------------------------------------------------

        const tab = {

            index:
            index,

            page:
            page,

            allianceSelect:
            allianceSelect,

            allianceLabel:
            allianceLabel,

            languageLabel:
            languageLabel,

            languageSelect:
            languageSelect,

            pointSizeLabel:
            pointSizeLabel,

            pointSizeSelect:
            pointSizeSelect,

            automaticTimeLabel:
            null,

            allianceName:
            '',

            snapshotButton:
            snapshotButton,

            snapshotLabel:
            snapshotLabel,

            nextCheckLabel:
            nextCheckLabel,

            statusLabel:
            statusLabel,

            updateCountdownLabel:
            updateCountdownLabel,

            nextUpdateAt:
            null,

            countdownTimer:
            null,

            tableModel:
            tableModel,

            table:
            table,

            tableContainer:
            tableContainer,

            columnModel:
            columnModel,

            columnWidths:
            savedColumnWidths || null,

            columnSaveTimer:
            null,

            hourChangeRenderer:
            hourChangeRenderer,

            automaticCheckBox:
            automaticCheckBox,

            automaticTimeField:
            automaticTimeField,

            automaticSaveButton:
            automaticSaveButton,

            automaticStatusLabel:
            automaticStatusLabel,

            startSnapshotTime:
            null,

            startSnapshotPlayers:
            null,

            hourReferencePlayers:
            null,

            hourReferenceStartTime:
            null,

            currentPlayers:
            null,

            completedHours:
            [],

            currentHourIndex:
            0,

            hourTimer:
            null,

            updateTimer:
            null,

            automaticTimer:
            null,

            nextHourTime:
            null,

            lastAutomaticSnapshotDate:
            null,

            // Erhöht sich bei jedem neuen Messzyklus. Alte, noch laufende
            // Netzwerkantworten dürfen danach keine Daten mehr überschreiben.
            requestGeneration:
            0,

            automaticSnapshotInProgress:
            false,

            // Die Mess-Timer laufen auch bei geschlossenem Dashboard weiter.
            // windowOpen steuert ausschließlich die QoX-Darstellung.
            windowOpen:
            true,

            automaticEnabled:
            false,

            automaticTimeValue:
            '21:00',

            automaticDueTimer:
            null,

            initializing:
            true
        };

        if (index === 0) {
            tab.automaticTimeLabel = automaticTimeLabel;
            tab.automaticEnabled = automaticCheckBox.getValue();
            tab.automaticTimeValue = automaticTimeField.getValue() || '21:00';
        }

        // Das Tab muss bereits registriert sein, bevor QoX beim
        // Wiederherstellen der Einstellungen changeValue/changeSelection auslöst.
        tabs.push(
            tab
        );

        // -----------------------------------------------------
        // GESPEICHERTE AUTOMATIK
        // -----------------------------------------------------

        const saved =
              settings.tabs[index];

        if (saved && index === 0) {

            automaticCheckBox.setValue(
                saved.automatic === true
            );

            automaticTimeField.setValue(
                saved.automaticTime ||
                '21:00'
            );

            tab.automaticEnabled = saved.automatic === true;
            tab.automaticTimeValue = saved.automaticTime || '21:00';
        }

        // -----------------------------------------------------
        // SPRACHAUSWAHL – NUR REITER 1
        // -----------------------------------------------------

        if (index === 0 && languageSelect) {

            const languageItems =
                  languageSelect.getChildren();

            const selectedLanguageItem =
                  languageItems.find(function (item) {
                      return item.getUserData('languageCode') === currentLanguage;
                  });

            if (selectedLanguageItem) {
                languageSelect.setSelection([selectedLanguageItem]);
            }

            languageSelect.addListener(
                'changeSelection',
                function () {

                    const selection = languageSelect.getSelection();

                    if (!selection || !selection.length) {
                        return;
                    }

                    const code =
                          selection[0].getUserData('languageCode');

                    if (!LANGUAGES[code] || code === currentLanguage) {
                        return;
                    }

                    currentLanguage = code;

                    updateLanguage();
                    saveSettings();

                    log.success(
                        'Sprache geändert: ' + LANGUAGES[code].name
                    );
                }
            );
        }

        // -----------------------------------------------------
        // ALLIANZ-AUSWAHL
        // -----------------------------------------------------

        allianceSelect.addListener(
            'changeSelection',

            function () {

                const selection =
                      allianceSelect
                .getSelection();

                if (
                    !selection ||
                    !selection.length
                ) {

                    return;
                }

                const selected =
                      selection[0];

                const newAllianceName =
                      selected.getUserData(
                          'allianceName'
                      ) || '';

                if (!newAllianceName) {
                    return;
                }

                // Beim Aufbau des Reiters wird die gespeicherte Auswahl
                // ebenfalls per changeSelection gesetzt. Das ist noch kein
                // echter Benutzerwechsel und darf deshalb keinen neuen
                // Messzyklus starten.
                if (tab.initializing) {
                    tab.allianceName = newAllianceName;
                    return;
                }

                // Nur dieser Reiter wird gewechselt.
                // Alle anderen Reiter und deren Messdaten bleiben unangetastet.
                tab.allianceName = newAllianceName;

                // Alte Messrunde dieses Reiters sofort verwerfen und die
                // Darstellung leeren. Dadurch können Antworten einer alten
                // Allianz nicht mehr in diesen Reiter zurückschreiben.
                resetMeasurementDisplay(
                    tab,
                    'Allianzwechsel'
                );

                const requestGeneration =
                      tab.requestGeneration;

                const requestedAlliance =
                      tab.allianceName;

                statusLabel.setValue(
                    tFormat('selectedAlliance', requestedAlliance)
                );

                // WICHTIG:
                // Die Allianz wird sofort und unabhängig vom späteren
                // Netzwerkabruf dauerhaft gespeichert. Damit kann ein
                // späteres Schließen/Öffnen nicht wieder die alte Allianz
                // aus den gespeicherten Einstellungen herstellen.
                persistTabAllianceSelection(
                    tab
                );

                // Die Spieler der NEU ausgewählten Allianz werden jetzt nur
                // für diesen Reiter abgerufen. Erst nach erfolgreicher Antwort
                // wird für diesen Reiter ein neuer Messzyklus gestartet.
                requestAlliancePlayers(
                    requestedAlliance,
                    function (players) {

                        // Zwischenzeitlich wurde erneut gewechselt?
                        // Dann diese Antwort ignorieren.
                        if (
                            requestGeneration !==
                            (tab.requestGeneration || 0) ||
                            requestedAlliance !== tab.allianceName
                        ) {
                            log.warning(
                                'Spielerantwort nach erneutem Allianzwechsel verworfen – Reiter ' +
                                (index + 1) + '.'
                            );
                            return;
                        }

                        // Jetzt beginnt der neue Messzyklus wirklich:
                        // Die geladenen Spieler werden als neuer Start-Snapshot
                        // gesetzt und die aktuelle Stunde wird neu referenziert.
                        startNewMeasurement(
                            tab,
                            players,
                            'Allianzwechsel zu ' + requestedAlliance
                        );

                        // startNewMeasurement() setzt den Status zunächst
                        // korrekt auf "Messung aktiv | Stunde ...".
                        // Nicht mehr mit "X Spieler erfasst" überschreiben,
                        // sonst sieht es so aus, als hätte kein Messzyklus
                        // begonnen.
                        updateStatus(tab);
                        updateNextHourDisplay(
                            tab,
                            getGameServerDate()
                        );

                        // Sicherheitshalber den vollständigen neuen Messzustand
                        // nochmals dauerhaft speichern.
                        saveSettings();

                        log.success(
                            'Reiter ' +
                            (index + 1) +
                            ': Neuer Messzyklus für Allianz "' +
                            requestedAlliance +
                            '" gestartet – ' +
                            players.length +
                            ' Spieler als Start-Snapshot erfasst.'
                        );
                    },
                    function (error) {

                        // Die neue Allianz bleibt ausgewählt, aber es wird
                        // kein alter Messstand wiederhergestellt.
                        if (
                            requestGeneration !==
                            (tab.requestGeneration || 0) ||
                            requestedAlliance !== tab.allianceName
                        ) {
                            return;
                        }

                        statusLabel.setValue(
                            'Fehler beim Laden der Allianz.'
                        );

                        log.error(
                            'Reiter ' +
                            (index + 1) +
                            ': Allianz "' +
                            requestedAlliance +
                            '" konnte nicht geladen werden.',
                            error
                        );
                    }
                );

                log.success(
                    'Reiter ' +
                    (index + 1) +
                    ': Allianz "' +
                    requestedAlliance +
                    '" ausgewählt – lade Mitglieder.'
                );
            }
        );

        // -----------------------------------------------------
        // GESPEICHERTE ALLIANZ AUSWÄHLEN
        // -----------------------------------------------------

        const items =
              allianceSelect.getChildren();

        let selectedItem =
            null;

        if (
            saved &&
            saved.alliance
        ) {

            selectedItem =
                items.find(
                function (item) {

                    return (
                        item.getUserData(
                            'allianceName'
                        ) ===
                        saved.alliance
                    );
                }
            );
        }

        if (
            !selectedItem &&
            items.length
        ) {

            selectedItem =
                items[0];
        }

        if (selectedItem) {

            allianceSelect.setSelection([
                selectedItem
            ]);

            tab.allianceName =
                selectedItem.getUserData(
                'allianceName'
            ) || '';

            log.success(
                'Reiter ' +
                (index + 1) +
                ': gespeicherte Allianz "' +
                tab.allianceName +
                '" wiederhergestellt.'
            );
        }

        // -----------------------------------------------------
        // GESPEICHERTEN MESSSZUSTAND WIEDERHERSTELLEN
        // -----------------------------------------------------

        restoreMeasurement(
            tab,
            saved
        );

        if (tab.startSnapshotPlayers && tab.allianceName) {
            // Beim Öffnen sofort den tatsächlichen Stundenindex prüfen.
            // Die Punktdaten werden anschließend durch den normalen Abruf
            // aktualisiert.
            updateNextHourDisplay(tab, new Date());
        }

        // Ab jetzt werden Änderungen des Benutzers gespeichert.
        // Während der Wiederherstellung darf noch nichts
        // zurückgeschrieben werden, sonst würden die gespeicherten
        // Messdaten mit einem leeren Zustand überschrieben.
        tab.initializing = false;

        // Manuelles Ziehen der Spaltenbreiten über den Tabellenkopf.
        // Die Breite wird beim Loslassen dauerhaft gespeichert.
        installManualColumnResize(tab);

        // Spaltenbreiten können direkt im Tabellenkopf gezogen werden.
        // Die Breiten werden pro Reiter dauerhaft gespeichert.
        columnModel.addListener(
            'widthChanged',
            function () {

                // Während des Wiederaufbaus des Fensters dürfen automatische
                // Breitenänderungen KEINE Einstellungen speichern. Sonst
                // kann ein Reiter, dessen Messzustand noch nicht restauriert
                // wurde, den bereits gespeicherten Messzustand überschreiben.
                if (tab.initializing) {
                    return;
                }

                if (tab.columnSaveTimer) {
                    clearTimeout(tab.columnSaveTimer);
                }

                tab.columnSaveTimer =
                    setTimeout(
                    function () {
                        tab.columnSaveTimer = null;

                        // Zusätzliche Sicherheitsprüfung gegen einen
                        // inzwischen gestarteten Wiederaufbau.
                        if (tab.initializing) {
                            return;
                        }

                        saveSettings();
                    },
                    300
                );
            }
        );

        // -----------------------------------------------------
        // PUNKTGRÖSSE – KOMFORTFUNKTION
        // -----------------------------------------------------

        if (pointSizeSelect) {

            const savedSize =
                  Number(settings && settings.hourFontSize);

            const wantedSize =
                  Number.isInteger(savedSize) &&
                  savedSize >= 9 &&
                  savedSize <= 12
            ? savedSize
            : 11;

            const sizeItems =
                  pointSizeSelect.getChildren();

            const selectedSizeItem =
                  sizeItems.find(function (item) {
                      return Number(
                          item.getUserData('fontSize')
                      ) === wantedSize;
                  });

            if (selectedSizeItem) {
                pointSizeSelect.setSelection([
                    selectedSizeItem
                ]);
            }

            pointSizeSelect.addListener(
                'changeSelection',
                function () {

                    const selection =
                          pointSizeSelect.getSelection();

                    if (!selection || !selection.length) {
                        return;
                    }

                    const newSize = Number(
                        selection[0].getUserData('fontSize')
                    );

                    if (
                        !Number.isInteger(newSize) ||
                        newSize < 9 ||
                        newSize > 12
                    ) {
                        return;
                    }

                    hourFontSize = newSize;

                    // Renderer erneut setzen.
                    if (tab.hourChangeRenderer) {
                        for (let col = 3; col < 27; col++) {
                            tab.columnModel.setDataCellRenderer(
                                col,
                                tab.hourChangeRenderer
                            );
                        }
                    }

                    // WICHTIG:
                    // setDataCellRenderer() allein löst in der verwendeten
                    // C&C-TA-qx-Version kein sofortiges Neuzeichnen aus.
                    // Durch erneutes Setzen der vorhandenen Daten erzwingen
                    // wir ein dataChanged-Event und damit einen Repaint der
                    // 24 Stunden-Spalten.
                    try {
                        if (tab.tableModel && tab.tableModel.getData) {
                            const currentData = tab.tableModel.getData();
                            tab.tableModel.setData(currentData || []);
                        }
                    } catch (refreshError) {
                        log.warning(
                            'Punktgröße geändert, Tabelle konnte nicht sofort neu gezeichnet werden.',
                            refreshError
                        );
                    }

                    saveSettings();

                    log.success(
                        'Punktgröße der Stundenwerte geändert: ' +
                        newSize + ' px'
                    );
                }
            );
        }

        // -----------------------------------------------------
        // SNAPSHOT
        // -----------------------------------------------------

        snapshotButton.addListener(
            'execute',

            function () {

                // Jeder manuelle Snapshot-Button startet den Snapshot
                // für alle Reiter, in denen eine Allianz hinterlegt ist.
                performSnapshotAllTabs(
                    'manuell'
                );
            }
        );

        // -----------------------------------------------------
        // AUTOMATIK SPEICHERN
        // -----------------------------------------------------

        if (index === 0) {

            automaticSaveButton.addListener(
                'execute',

                function () {

                    const value =
                          automaticTimeField
                    .getValue();

                    if (
                        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
                            value
                        )
                    ) {

                        automaticStatusLabel.setValue(
                            t('invalidTime')
                        );

                        log.warning(
                            'Reiter ' +
                            (index + 1) +
                            ': ungültige Uhrzeit "' +
                            value +
                            '".'
                        );

                        return;
                    }

                    tab.automaticTimeValue = value;
                    tab.automaticEnabled = automaticCheckBox.getValue();

                    saveSettings();

                    if (
                        automaticCheckBox.getValue()
                    ) {

                        updateAutomaticStatus(tab);

                    } else {

                        updateAutomaticStatus(tab);
                    }

                    log.success(
                        'Reiter ' +
                        (index + 1) +
                        ': Automatik gespeichert – ' +
                        value
                    );
                }
            );

        }

        // -----------------------------------------------------
        // AUTOMATIK EIN/AUS
        // -----------------------------------------------------

        if (index === 0) {

            automaticCheckBox.addListener(
                'changeValue',

                function () {

                    tab.automaticEnabled = automaticCheckBox.getValue();
                    tab.automaticTimeValue = automaticTimeField.getValue() || tab.automaticTimeValue || '21:00';

                    if (!tab.initializing) {
                        saveSettings();
                    }

                    if (
                        automaticCheckBox.getValue()
                    ) {

                        updateAutomaticStatus(tab);

                    } else {

                        updateAutomaticStatus(tab);
                    }
                }
            );

        }

        if (
            index === 0 &&
            automaticCheckBox.getValue()
        ) {

            updateAutomaticStatus(tab);
        }

        // -----------------------------------------------------
        // TIMER
        // -----------------------------------------------------

        startUpdateTimer(
            tab
        );

        startAutomaticTimer(
            tab
        );

        return page;
    }

    // =========================================================
    // FENSTER ERSTELLEN
    // =========================================================

    function createActivityWindow(
    alliances
    ) {

        log.section(
            'AKTIVITÄTSCHECKER – FENSTER ERSTELLEN'
        );

        const settings =
              loadSettings();

        // Falls das Dashboard nach einer geschlossenen Messrunde erneut
        // geöffnet wird: alte Hintergrund-Timer sauber anhalten. Die Daten
        // selbst liegen bereits dauerhaft in GM_setValue und werden beim
        // Erstellen der neuen Tabs wiederhergestellt.
        if (tabs.length) {
            tabs.forEach(function (oldTab) {
                if (oldTab.hourTimer) clearTimeout(oldTab.hourTimer);
                if (oldTab.updateTimer) clearInterval(oldTab.updateTimer);
                if (oldTab.automaticTimer) clearInterval(oldTab.automaticTimer);
                if (oldTab.automaticDueTimer) clearTimeout(oldTab.automaticDueTimer);
                if (oldTab.columnSaveTimer) clearTimeout(oldTab.columnSaveTimer);
            });
            tabs.length = 0;
        }

        currentLanguage =
            LANGUAGES[settings.language] ? settings.language : 'de';

        activityWindow =
            new qx.ui.window.Window(
            SCRIPT_NAME
        );

        activityWindow.setLayout(
            new qx.ui.layout.Grow()
        );

        activityWindow.set({
            width: 1580,
            height: 650,
            showMinimize: false,
            showMaximize: true,
            resizable: true,
            allowMaximize: true
        });

        const tabView =
              new qx.ui.tabview.TabView();

        tabView.set({
            contentPadding: 6
        });

        for (
            let i = 0;
            i < TAB_COUNT;
            i++
        ) {

            tabView.add(
                createTab(
                    i,
                    alliances,
                    settings
                )
            );
        }

        updateLanguage();

        activityWindow.add(
            tabView
        );

        activityWindow.addListener(
            'close',

            function () {

                log.info(
                    'Fenster wird geschlossen – Einstellungen werden gespeichert.'
                );

                tabs.forEach(
                    function (tab) {

                        // Erst die UI als geschlossen markieren. Dadurch
                        // verwendet saveSettings() nur die bereits gespeicherten
                        // Spaltenbreiten und nicht mehr das gerade verschwindende
                        // QoX-ColumnModel.
                        tab.windowOpen = false;

                        // Nur ein rein visueller Speichertimer wird beendet.
                        if (tab.columnSaveTimer) {
                            clearTimeout(tab.columnSaveTimer);
                            tab.columnSaveTimer = null;
                        }

                        if (tab.countdownTimer) {
                            clearInterval(tab.countdownTimer);
                            tab.countdownTimer = null;
                        }
                    }
                );

                // Jetzt den vollständigen Messzustand speichern.
                saveSettings();

                // tabs bleibt absichtlich erhalten. Beim nächsten Öffnen
                // werden die Timer übernommen und anschließend sauber durch
                // neue UI-Tabs ersetzt.

                activityWindow =
                    null;

                log.success(
                    'Fenster geschlossen und Einstellungen gespeichert.'
                );
            }
        );

        qxApp
            .getRoot()
            .add(
            activityWindow
        );

        activityWindow.open();

        activityWindow.center();

        tabs.forEach(
            function (tab) {

                scheduleNextHour(
                    tab
                );

                // Sofortiger Mess-Check beim Öffnen des Dashboards.
                // Damit wird eine Punkteänderung seit dem letzten gespeicherten
                // Messstand sofort erkannt, ohne auf den nächsten 5-Minuten-Zyklus
                // warten zu müssen.
                if (tab.startSnapshotPlayers && tab.allianceName) {
                    setTimeout(function () {
                        refreshCurrentActivity(tab);
                    }, 100);
                }
            }
        );

        log.success(
            'Aktivitätschecker-Fenster geöffnet.'
        );
    }

    // =========================================================
    // FENSTER ÖFFNEN
    // =========================================================

    function openActivityWindow() {

        log.section(
            'AKTIVITÄTSCHECKER AUFRUF'
        );

        if (activityWindow) {

            activityWindow.open();

            activityWindow.center();

            return;
        }

        requestTop25Alliances(

            function (alliances) {

                createActivityWindow(
                    alliances
                );
            }
        );
    }

    // =========================================================
    // MENÜEINTRAG
    // =========================================================

    function addScriptsMenuEntry() {

        log.section(
            'SCRIPTE-MENÜ'
        );

        try {

            const scriptsButton =
                  qxApp
            .getMenuBar()
            .getScriptsButton();

            if (!scriptsButton) {

                log.error(
                    'Scripte-Button nicht gefunden.'
                );

                return;
            }

            scriptsButton.Add(
                SCRIPT_NAME
            );

            log.success(
                'Menüeintrag hinzugefügt.'
            );

            const menu =
                  scriptsButton.getMenu();

            if (!menu) {

                log.error(
                    'Scripte-Menü nicht gefunden.'
                );

                return;
            }

            const menuItem =
                  menu
            .getChildren()
            .find(
                function (item) {

                    return (
                        item.getLabel &&
                        item.getLabel() ===
                        SCRIPT_NAME
                    );
                }
            );

            if (!menuItem) {

                log.error(
                    'Menüeintrag "' +
                    SCRIPT_NAME +
                    '" nicht gefunden.'
                );

                return;
            }

            menuItem.addListener(
                'execute',

                function () {

                    log.section(
                        'MENÜ-KLICK'
                    );

                    log.success(
                        'Aktivitätschecker wurde angeklickt.'
                    );

                    openActivityWindow();
                }
            );

            log.success(
                'Klick-Listener erfolgreich registriert.'
            );

        } catch (e) {

            log.error(
                'Fehler beim Scripte-Menü:',
                e
            );

        }
    }

    // =========================================================
    // AUF SPIEL WARTEN
    // =========================================================

    function waitForGame() {

        try {

            if (
                typeof qx === 'undefined' ||
                typeof ClientLib === 'undefined'
            ) {

                setTimeout(
                    waitForGame,
                    1000
                );

                return;
            }

            if (
                !qx.core ||
                !qx.core.Init ||
                !qx.core.Init.getApplication
            ) {

                setTimeout(
                    waitForGame,
                    1000
                );

                return;
            }

            qxApp =
                qx.core.Init
                .getApplication();

            if (!qxApp) {

                setTimeout(
                    waitForGame,
                    1000
                );

                return;
            }

            if (
                !qxApp.getMenuBar ||
                !qxApp.getMenuBar()
            ) {

                setTimeout(
                    waitForGame,
                    1000
                );

                return;
            }

            if (
                !qxApp
                .getMenuBar()
                .getScriptsButton()
            ) {

                setTimeout(
                    waitForGame,
                    1000
                );

                return;
            }

            initialize();

        } catch (e) {

            log.error(
                'Initialisierungsfehler:',
                e
            );

            setTimeout(
                waitForGame,
                1000
            );
        }
    }

    // =========================================================
    // INITIALISIERUNG
    // =========================================================

    function initialize() {

        log.section(
            'INITIALISIERUNG'
        );

        addScriptsMenuEntry();

        log.success(
            SCRIPT_NAME +
            ' gestartet.'
        );
    }

    // =========================================================
    // START
    // =========================================================

    waitForGame();

})();