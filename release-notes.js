'use strict';
// Release-Notes fuer das "Was ist neu"-Fenster, pro Version eine Liste von Slides.
// title/text sind entweder ein String (nur Deutsch, Legacy) oder ein {de,en,fr,it}-Objekt;
// localize() in i18n.js waehlt daraus. Optionales `icon`, optionales `image` (Pfad relativ
// zum App-Verzeichnis oder data:-URL), optionales `if: 'snap'|'appimage'`.
// Reine Daten, kein Electron-Zugriff.

// Wenn die aktuelle Version in dieser Map steht, werden die hier gelisteten
// älteren Versionen beim "Was ist neu"-Fenster zusätzlich gezeigt. Gedacht für
// Hotfixes, in denen die Notes der Vorgängerversion in einer fehlerhaften Form
// (z.B. falscher Sprache) angezeigt wurden und nachgereicht werden sollen.
const RELEASE_NOTES_REVISIT = {
  '1.4.1': ['1.4.0']
};

const RELEASE_NOTES = {
  '1.4.21': [
    {
      icon: 'heart',
      title: {
        de: 'Die App bleibt kostenlos',
        en: 'The app stays free',
        fr: 'L’application reste gratuite',
        it: 'L’app resta gratuita'
      },
      text: {
        de: 'Keine Werbung, keine gesperrten Funktionen, und daran ändert sich nichts. Die App entsteht in meiner Freizeit. Wer möchte, kann die Entwicklungskosten mit einer freiwilligen Zahlung über Ko-fi unterstützen: im Menü unter „App unterstützen“ oder im Fenster „Über“. Danke an alle, die die App nutzen und Fehler melden.',
        en: 'No ads, no locked features, and that is not changing. I build the app in my spare time. If you like, you can support the development costs with a voluntary payment on Ko-fi: in the menu under “Support the app” or in the About window. Thanks to everyone who uses it and reports bugs.',
        fr: 'Pas de publicité, aucune fonction bloquée, et cela ne changera pas. Je développe l’application sur mon temps libre. Si vous le souhaitez, vous pouvez soutenir les frais de développement par un paiement volontaire sur Ko-fi : dans le menu sous « Soutenir l’app » ou dans la fenêtre « À propos ». Merci à toutes celles et ceux qui l’utilisent et signalent des bugs.',
        it: 'Niente pubblicità, nessuna funzione bloccata, e non cambierà. Sviluppo l’app nel tempo libero. Se vuoi, puoi sostenere i costi di sviluppo con un pagamento volontario su Ko-fi: nel menu alla voce «Sostieni l’app» o nella finestra «Informazioni». Grazie a chi la usa e segnala i bug.'
      }
    },
    {
      icon: 'palette',
      title: {
        de: '„Design“ heißt jetzt „App-Theme“',
        en: '“Design” is now called “App Theme”',
        fr: '« Design » s’appelle désormais « Thème de l’app »',
        it: '«Design» ora si chiama «Tema dell’app»'
      },
      text: {
        de: 'Der Menüeintrag für Farbthema und Stil wurde leicht mit Claude Design verwechselt. Er heißt jetzt „App-Theme“, das Fenster dahinter ist dasselbe.',
        en: 'The menu entry for colour theme and style was easy to mistake for Claude Design. It is now called “App Theme”, the window behind it is the same.',
        fr: 'L’entrée de menu pour le thème et le style se confondait facilement avec Claude Design. Elle s’appelle désormais « Thème de l’app », la fenêtre reste la même.',
        it: 'La voce di menu per tema e stile si confondeva facilmente con Claude Design. Ora si chiama «Tema dell’app», la finestra è la stessa.'
      }
    },
    {
      icon: 'info',
      title: {
        de: 'Genauere Fehlerberichte',
        en: 'More precise bug reports',
        fr: 'Rapports de bug plus précis',
        it: 'Segnalazioni più precise'
      },
      text: {
        de: 'Die kopierten Diagnose-Infos und der Fehlerbericht nennen jetzt auch Distribution, Desktop-Umgebung und die Skalierung der Monitore. Damit lassen sich Darstellungsfehler wie unscharfer Text bei 125 % schneller zuordnen.',
        en: 'Copied diagnostics and bug reports now also name the distribution, the desktop environment and the display scale. That makes rendering issues such as soft text at 125% easier to pin down.',
        fr: 'Les infos de diagnostic copiées et le rapport de bug indiquent désormais aussi la distribution, l’environnement de bureau et la mise à l’échelle des écrans. Les problèmes d’affichage, comme un texte flou à 125 %, sont ainsi plus faciles à cerner.',
        it: 'Le informazioni di diagnostica copiate e la segnalazione di bug indicano ora anche la distribuzione, l’ambiente desktop e il ridimensionamento degli schermi. Così i problemi di visualizzazione, come il testo sfocato al 125%, si individuano più in fretta.'
      }
    }
  ],
  '1.4.20': [
    {
      icon: 'palette',
      title: {
        de: 'Das Farbthema steht sofort',
        en: 'The colour theme is there right away',
        fr: 'Le thème de couleur est là tout de suite',
        it: 'Il tema colore c’è subito'
      },
      text: {
        de: 'Beim Start und beim Laden einer Seite blitzten kurz claude.ais eigene Farben auf: Karten mit blauem Rand, das Logo in Orange, Flächen in Grau. Erst danach übernahm dein Thema. Jetzt steht es ab dem ersten Bild. Auf langsameren Rechnern war das bisher am deutlichsten zu sehen.',
        en: 'When starting the app or loading a page, claude.ai’s own colours used to show first: cards with a blue border, the logo in orange, surfaces in grey. Your theme only took over afterwards. It is now in place from the first frame. This was most noticeable on slower machines.',
        fr: 'Au démarrage et au chargement d’une page, les couleurs de claude.ai apparaissaient brièvement : cartes à bordure bleue, logo en orange, surfaces en gris. Votre thème ne prenait le relais qu’ensuite. Il est maintenant en place dès la première image. C’était surtout visible sur les machines lentes.',
        it: 'All’avvio e al caricamento di una pagina comparivano prima i colori di claude.ai: schede con bordo blu, logo arancione, superfici grigie. Il tuo tema subentrava solo dopo. Ora è presente fin dal primo fotogramma. Si notava soprattutto sui computer più lenti.'
      }
    },
    {
      icon: 'bug',
      title: {
        de: 'Zeichenregen beim Kaltstart',
        en: 'Character rain on a cold start',
        fr: 'Pluie de caractères au démarrage à froid',
        it: 'Pioggia di caratteri all’avvio a freddo'
      },
      text: {
        de: 'Im Matrix-Thema fehlte der Regen direkt nach dem Öffnen der App, der Hintergrund blieb einfarbig, bis die Seite fertig geladen war. Die Umschaltung auf die bewegte Ebene passierte, bevor es diese Ebene überhaupt gab.',
        en: 'In the Matrix theme the rain was missing right after opening the app, the background stayed plain until the page had finished loading. The switch to the moving layer happened before that layer could exist.',
        fr: 'Dans le thème Matrix, la pluie manquait juste après l’ouverture de l’application, le fond restait uni jusqu’à la fin du chargement. Le passage à la couche animée se faisait avant que cette couche puisse exister.',
        it: 'Nel tema Matrix la pioggia mancava subito dopo l’apertura dell’app, lo sfondo restava uniforme fino al termine del caricamento. Il passaggio al livello animato avveniva prima che quel livello potesse esistere.'
      }
    }
  ],
  '1.4.19': [
    {
      icon: 'palette',
      title: {
        de: 'Neues Farbthema: Matrix',
        en: 'New colour theme: Matrix',
        fr: 'Nouveau thème de couleur : Matrix',
        it: 'Nuovo tema colore: Matrix'
      },
      text: {
        de: 'Ein fünftes Farbthema auf grünstichigem, fast schwarzem Grund, mit einem Zeichenregen im Hintergrund. Dazu gibt es Matrix auch als Stil, also als reine Akzentfarbe in Smaragdgrün, die sich mit jedem Farbthema kombinieren lässt. Beides findest du im Design-Fenster.',
        en: 'A fifth colour theme on green tinted near black, with a character rain in the background. Matrix also comes as a style, that is as an accent colour in emerald green that combines with any colour theme. Both live in the design window.',
        fr: 'Un cinquième thème de couleur sur un noir profond teinté de vert, avec une pluie de caractères en arrière-plan. Matrix existe aussi comme style, c’est-à-dire une couleur d’accent vert émeraude qui se combine avec tous les thèmes. Les deux se trouvent dans la fenêtre Design.',
        it: 'Un quinto tema colore su un nero quasi pieno con sfumatura verde, con una pioggia di caratteri sullo sfondo. Matrix c’è anche come stile, cioè come colore d’accento verde smeraldo che si combina con qualsiasi tema. Trovi entrambi nella finestra Design.'
      }
    },
    {
      icon: 'refresh',
      title: {
        de: 'Der Zeichenregen fällt, wenn du willst',
        en: 'The character rain falls if you want it to',
        fr: 'La pluie de caractères tombe si vous le souhaitez',
        it: 'La pioggia di caratteri cade se vuoi'
      },
      text: {
        de: 'Im Matrix-Thema kann der Regen Zeile für Zeile nach unten wandern. Er springt zeilenweise statt zu gleiten, dadurch braucht er kaum Rechenleistung. Ein eigener Schalter im Design-Fenster stellt ihn ab, und wer im System Bewegungen reduziert hat, bekommt ihn gar nicht erst zu sehen.',
        en: 'In the Matrix theme the rain can travel downwards line by line. It steps instead of gliding, so it needs very little processing power. A switch in the design window turns it off, and anyone who reduces motion system wide never sees it move.',
        fr: 'Dans le thème Matrix, la pluie peut descendre ligne par ligne. Elle avance par paliers au lieu de glisser et demande donc très peu de ressources. Un interrupteur dans la fenêtre Design la désactive, et si vous avez réduit les animations au niveau du système, elle ne bouge pas du tout.',
        it: 'Nel tema Matrix la pioggia può scendere riga per riga. Avanza a scatti invece di scorrere, quindi richiede pochissime risorse. Un interruttore nella finestra Design la disattiva, e chi ha ridotto le animazioni a livello di sistema non la vede muoversi affatto.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: 'Deutlich weniger Last im Leerlauf',
        en: 'Much less load while idle',
        fr: 'Nettement moins de charge au repos',
        it: 'Molto meno carico a riposo'
      },
      text: {
        de: 'Der farbige Rahmen um das Eingabefeld hat seinen Verlauf sechzig Mal pro Sekunde neu berechnet, dauerhaft, auch wenn die App nur offen stand. Gemessen hat das rund einen halben Prozessorkern gekostet. Er bewegt sich jetzt in Stufen und braucht dafür ein Viertel davon. Betroffen waren alle Stile ausser Classic.',
        en: 'The coloured ring around the input field recomputed its gradient sixty times a second, continuously, even when the app just sat there. Measured, that cost about half a processor core. It now moves in steps and needs a quarter of that. Every style except Classic was affected.',
        fr: 'Le cadre coloré autour du champ de saisie recalculait son dégradé soixante fois par seconde, en continu, même lorsque l’application restait simplement ouverte. Mesuré, cela coûtait environ un demi-cœur de processeur. Il avance désormais par paliers et n’en demande qu’un quart. Tous les styles sauf Classic étaient concernés.',
        it: 'La cornice colorata attorno al campo di inserimento ricalcolava il suo gradiente sessanta volte al secondo, di continuo, anche quando l’app era solo aperta. Misurato, costava circa mezzo core del processore. Ora avanza a scatti e ne richiede un quarto. Erano interessati tutti gli stili tranne Classic.'
      }
    },
    {
      icon: 'bell',
      title: {
        de: 'Benachrichtigungen kommen wieder an',
        en: 'Notifications arrive again',
        fr: 'Les notifications arrivent de nouveau',
        it: 'Le notifiche arrivano di nuovo'
      },
      text: {
        de: 'Die Meldung, wenn Claude in einem anderen Tab fertig geantwortet hat, blieb aus. Die App erkennt das am Stopp-Knopf im Eingabefeld, suchte ihn aber auf der ganzen Seite und fand dabei auch Einträge aus der Seitenleiste, etwa "Weitere Optionen für ... abbrechen". Dadurch hielt sie Claude für dauerhaft beschäftigt. Gesucht wird jetzt nur noch direkt am Eingabefeld.',
        en: 'The notice when Claude finished answering in another tab stayed away. The app spots that by the stop button in the composer, but searched the whole page for it and also matched sidebar entries such as "More options for ... cancel". So it thought Claude was busy forever. It now only looks at the composer itself.',
        fr: 'L’avis indiquant que Claude a terminé sa réponse dans un autre onglet n’arrivait plus. L’application le détecte au bouton d’arrêt de la zone de saisie, mais le cherchait dans toute la page et trouvait aussi des entrées de la barre latérale, par exemple « Plus d’options pour ... annuler ». Elle croyait donc Claude occupé en permanence. La recherche se limite désormais à la zone de saisie.',
        it: 'L’avviso che Claude ha finito di rispondere in un’altra scheda non arrivava più. L’app lo riconosce dal pulsante di stop nel campo di inserimento, ma lo cercava in tutta la pagina e trovava anche voci della barra laterale, ad esempio "Altre opzioni per ... annulla". Così riteneva Claude sempre occupato. Ora cerca solo nel campo di inserimento.'
      }
    },
    {
      icon: 'check',
      title: {
        de: 'Kleinere Korrekturen',
        en: 'Smaller corrections',
        fr: 'Corrections mineures',
        it: 'Correzioni minori'
      },
      text: {
        de: 'Ein zweiter Start der App fuhr im Hintergrund alles hoch, bevor er sich beendete. Das Fenster mit den Fehlerberichten war zu gross und sagte dasselbe dreimal, es ist jetzt deutlich kleiner. Der Fensterrahmen ist in allen dunklen Themes wieder sichtbar, das Logo im Über-Fenster hat seine dunkle Kachel zurück, und ein Tab, der über den Tag verteilt mehrfach abstürzt, bleibt nicht mehr dauerhaft leer.',
        en: 'Starting the app a second time brought everything up in the background before quitting again. The bug report window was too large and said the same thing three times, it is noticeably smaller now. The window frame is visible again in every dark theme, the logo in the about window has its dark tile back, and a tab that crashes a few times over a day no longer stays blank for good.',
        fr: 'Un deuxième lancement de l’application démarrait tout en arrière-plan avant de se terminer. La fenêtre de rapport d’erreur était trop grande et répétait trois fois la même chose, elle est nettement plus compacte. Le cadre de la fenêtre est de nouveau visible dans tous les thèmes sombres, le logo de la fenêtre À propos a retrouvé sa tuile sombre, et un onglet qui plante plusieurs fois dans la journée ne reste plus vide définitivement.',
        it: 'Un secondo avvio dell’app caricava tutto in background prima di chiudersi. La finestra per le segnalazioni era troppo grande e ripeteva tre volte la stessa cosa, ora è molto più compatta. La cornice della finestra è di nuovo visibile in tutti i temi scuri, il logo nella finestra Informazioni ha di nuovo la sua piastrella scura, e una scheda che va in crash più volte nell’arco della giornata non resta più vuota per sempre.'
      }
    }
  ],
  '1.4.18': [
    {
      icon: 'check',
      title: {
        de: 'Screenshots aus dem Plus-Menü funktionieren',
        en: 'Screenshots from the plus menu work',
        fr: 'Les captures d’écran du menu plus fonctionnent',
        it: 'Gli screenshot dal menu più funzionano'
      },
      text: {
        de: 'Der Screenshot-Eintrag im Plus-Menü von claude.ai tat nichts, weil die App die Bildschirmaufnahme abgelehnt hat. Für claude.ai ist sie jetzt erlaubt. Unter Wayland wählst du den Bildschirm im Dialog des Systems, unter X11 nimmt die App den Bildschirm, auf dem ihr Fenster liegt. Die Kamera bleibt gesperrt.',
        en: 'The screenshot entry in claude.ai’s plus menu did nothing, because the app turned the screen capture down. It is allowed for claude.ai now. On Wayland you pick the screen in the system dialog, on X11 the app takes the screen its window is on. The camera stays blocked.',
        fr: 'L’entrée de capture d’écran dans le menu plus de claude.ai ne faisait rien, car l’application refusait la capture de l’écran. Elle est désormais autorisée pour claude.ai. Sous Wayland, vous choisissez l’écran dans la boîte de dialogue du système, sous X11 l’application prend l’écran où se trouve sa fenêtre. La caméra reste bloquée.',
        it: 'La voce per lo screenshot nel menu più di claude.ai non faceva nulla, perché l’app rifiutava la cattura dello schermo. Ora è consentita per claude.ai. Su Wayland scegli lo schermo nella finestra di dialogo del sistema, su X11 l’app prende lo schermo su cui si trova la sua finestra. La fotocamera resta bloccata.'
      }
    },
    {
      icon: 'palette',
      title: {
        de: 'Eingabefeld und Menü aufgeräumt',
        en: 'Input field and menu tidied up',
        fr: 'Champ de saisie et menu remis en ordre',
        it: 'Campo di inserimento e menu sistemati'
      },
      text: {
        de: 'Im Chat zeigt claude.ai Hinweis und Modellwahl jetzt unter dem Eingabefeld. Der farbige Rahmen hat beides mit eingefasst und stieß an den unteren Fensterrand. Er liegt wieder nur um das Eingabefeld und hängt jetzt am Stil: Modern und Neon zeigen ihn in jedem Farbthema, auch in Hell und Dunkel, Classic im Anthropic-Orange zeigt keinen. Im App-Menü waren zwei Einträge abgeschnitten. Das Menü ist breiter, und die drei Punkte hinter den Einträgen sind weg. Ein Wechsel des Stils lädt die Seite nicht mehr neu, und beim Öffnen eines neuen Chats flackert der Rahmen nicht mehr.',
        en: 'In a chat, claude.ai now shows the disclaimer and the model picker below the input field. The coloured ring framed both and ran into the bottom edge of the window. It sits around the input field only again and now follows the style: Modern and Neon show it in every colour theme, Light and Dark included, Classic in Anthropic orange shows none. In the app menu two entries were cut off. The menu is wider now, and the three dots after the entries are gone. Switching the style no longer reloads the page, and the ring no longer flickers when you open a new chat.',
        fr: 'Dans une conversation, claude.ai affiche désormais l’avertissement et le choix du modèle sous le champ de saisie. Le cadre coloré englobait les deux et touchait le bord inférieur de la fenêtre. Il entoure de nouveau uniquement le champ de saisie et suit désormais le style : Modern et Neon l’affichent dans chaque thème de couleur, y compris Clair et Sombre, Classic dans l’orange d’Anthropic n’en affiche aucun. Dans le menu de l’application, deux entrées étaient coupées. Le menu est plus large, et les trois points après les entrées ont disparu. Changer de style ne recharge plus la page, et le cadre ne clignote plus à l’ouverture d’une nouvelle conversation.',
        it: 'In una chat claude.ai mostra ora l’avviso e la scelta del modello sotto il campo di inserimento. La cornice colorata racchiudeva entrambi e toccava il bordo inferiore della finestra. Ora circonda di nuovo solo il campo di inserimento e segue lo stile: Modern e Neon la mostrano in ogni tema colore, anche Chiaro e Scuro, Classic nell’arancione di Anthropic non ne mostra nessuna. Nel menu dell’app due voci erano tagliate. Il menu è più largo e i tre puntini dopo le voci sono spariti. Cambiare stile non ricarica più la pagina, e la cornice non lampeggia più quando apri una nuova chat.'
      }
    },
    {
      icon: 'settings',
      title: {
        de: 'Fenster passen sich dem Bildschirm an',
        en: 'Windows fit the screen',
        fr: 'Les fenêtres s’adaptent à l’écran',
        it: 'Le finestre si adattano allo schermo'
      },
      text: {
        de: 'Dialoge wachsen auf großen Bildschirmen samt Inhalt mit und schrumpfen auf kleinen so weit, dass sie ganz draufpassen. Scrollen muss man darin nicht mehr. Das Hauptfenster startet passend zur Bildschirmgröße, und eine am großen Monitor gemerkte Größe ragt am Laptop nicht mehr aus dem Bild.',
        en: 'Dialogs grow with their content on large screens and shrink on small ones until they fit completely, so they no longer scroll. The main window starts at a size that suits the screen, and a size remembered on a large monitor no longer spills off a laptop display.',
        fr: 'Les boîtes de dialogue grandissent avec leur contenu sur les grands écrans et rétrécissent sur les petits jusqu’à tenir entièrement, sans défilement. La fenêtre principale démarre à une taille adaptée à l’écran, et une taille mémorisée sur un grand moniteur ne déborde plus sur un ordinateur portable.',
        it: 'Le finestre di dialogo crescono insieme al contenuto sugli schermi grandi e si riducono su quelli piccoli finché non ci stanno per intero, senza più scorrere. La finestra principale parte con una dimensione adatta allo schermo, e una dimensione memorizzata su un monitor grande non esce più dallo schermo del portatile.'
      }
    },
    {
      icon: 'shield',
      title: {
        de: 'Sicherheit unter der Haube',
        en: 'Security under the hood',
        fr: 'Sécurité sous le capot',
        it: 'Sicurezza dietro le quinte'
      },
      text: {
        de: 'Electron ist auf 41.10.7 aktualisiert. Hilfsbefehle laufen nicht mehr über eine Shell, Anmelde-Popups werden strenger erkannt, wiederhergestellte Tabs werden gegen die erlaubten Domains geprüft, und ein Absturz beim Speichern kann den Fensterzustand nicht mehr beschädigen.',
        en: 'Electron is updated to 41.10.7. Helper commands no longer go through a shell, login popups are detected more strictly, restored tabs are checked against the allowed domains, and a crash while saving can no longer corrupt the window state.',
        fr: 'Electron passe à la version 41.10.7. Les commandes d’aide ne passent plus par un shell, les fenêtres de connexion sont détectées plus strictement, les onglets restaurés sont vérifiés par rapport aux domaines autorisés, et un plantage pendant l’enregistrement ne peut plus corrompre l’état de la fenêtre.',
        it: 'Electron è aggiornato alla 41.10.7. I comandi di supporto non passano più da una shell, le finestre di accesso vengono riconosciute in modo più rigoroso, le schede ripristinate vengono controllate rispetto ai domini consentiti, e un crash durante il salvataggio non può più corrompere lo stato della finestra.'
      }
    }
  ],
  '1.4.17': [
    {
      icon: 'check',
      title: {
        de: 'Der Senden-Knopf war verdeckt',
        en: 'The send button was covered',
        fr: 'Le bouton d’envoi était masqué',
        it: 'Il pulsante di invio era coperto'
      },
      text: {
        de: 'Das Danke-Feld aus 1.4.16 lag unten rechts über dem Senden-Knopf und fing den Klick ab. Unterhalb von etwa 1444 Pixeln Fensterbreite verdeckte es rund drei Viertel des Knopfes, auf einem breiten Monitor gar nicht, deshalb ist es beim Testen nie aufgefallen. Gemeldet haben es zwei Leute, die nicht mehr senden konnten und keine Antwort mehr bekamen. Das Feld ist ganz entfernt.',
        en: 'The thank-you box from 1.4.16 sat over the send button in the lower right corner and swallowed the click. Below roughly 1444 pixels of window width it covered about three quarters of the button, on a wide monitor not at all, which is why it never showed up in testing. Two people reported it after they could not send any more and got no answer back. The box is gone.',
        fr: 'L’encadré de remerciement de la 1.4.16 se plaçait en bas à droite au-dessus du bouton d’envoi et absorbait le clic. En dessous d’environ 1444 pixels de largeur de fenêtre, il couvrait près des trois quarts du bouton, et pas du tout sur un écran large: le problème est donc passé inaperçu aux tests. Deux personnes l’ont signalé après ne plus pouvoir envoyer et ne plus recevoir de réponse. L’encadré est supprimé.',
        it: 'Il riquadro di ringraziamento della 1.4.16 si sovrapponeva in basso a destra al pulsante di invio e ne assorbiva il clic. Sotto i 1444 pixel circa di larghezza della finestra copriva circa tre quarti del pulsante, su un monitor largo per niente: per questo nei test non era mai emerso. Lo hanno segnalato due persone che non riuscivano più a inviare e non ricevevano risposta. Il riquadro è stato rimosso.'
      }
    }
  ],
  '1.4.16': [
    {
      // Steht bewusst an erster Stelle. Der Text nutzt HTML (slide-text wird als innerHTML
      // gesetzt) und die wn-*-Klassen, die nur hier verwendet werden.
      icon: 'heart',
      title: {
        de: 'Die offizielle App, und danke',
        en: 'The official app, and thank you',
        fr: 'L’application officielle, et merci',
        it: 'L’app ufficiale, e grazie'
      },
      text: {
        de: '<div class="wn-box"><b>Offizielle App, seit 30. Juni 2026</b><br>Ubuntu 22.04+ und Debian 12+, über Anthropics apt-Quelle, mit Cowork und Claude Code. Anleitung im Menü und in der Leiste oben.</div>'
          + '<div class="wn-box"><b>Diese App</b><br>Wird nicht eingestellt. Updates kommen weiter, neue Funktionen seltener als bisher. Auf Ubuntu 20.04 und im Snap Store bleibt sie die Alternative.</div>'
          + '<div class="wn-thanks">Danke an alle, die sie installiert und Fehler gemeldet haben. Dass sie täglich benutzt wird, war nicht selbstverständlich.</div>',
        en: '<div class="wn-box"><b>Official app, since 30 June 2026</b><br>Ubuntu 22.04+ and Debian 12+, through Anthropic’s apt repository, with Cowork and Claude Code. Setup steps in the menu and in the bar above.</div>'
          + '<div class="wn-box"><b>This app</b><br>Not being discontinued. Updates keep coming, new features less often than before. On Ubuntu 20.04 and in the Snap Store it stays the option.</div>'
          + '<div class="wn-thanks">Thank you to everyone who installed it and reported bugs. That it gets used daily was never a given.</div>',
        fr: '<div class="wn-box"><b>Application officielle, depuis le 30 juin 2026</b><br>Ubuntu 22.04+ et Debian 12+, via le dépôt apt d’Anthropic, avec Cowork et Claude Code. Procédure dans le menu et dans la barre ci-dessus.</div>'
          + '<div class="wn-box"><b>Cette application</b><br>N’est pas abandonnée. Les mises à jour continuent, les nouvelles fonctions plus rarement qu’avant. Sous Ubuntu 20.04 et dans le Snap Store, elle reste l’alternative.</div>'
          + '<div class="wn-thanks">Merci à tous ceux qui l’ont installée et ont signalé des bogues. Qu’elle serve au quotidien n’allait pas de soi.</div>',
        it: '<div class="wn-box"><b>App ufficiale, dal 30 giugno 2026</b><br>Ubuntu 22.04+ e Debian 12+, tramite il repository apt di Anthropic, con Cowork e Claude Code. Istruzioni nel menu e nella barra in alto.</div>'
          + '<div class="wn-box"><b>Questa app</b><br>Non viene abbandonata. Gli aggiornamenti continuano, nuove funzioni più raramente di prima. Su Ubuntu 20.04 e nello Snap Store resta l’alternativa.</div>'
          + '<div class="wn-thanks">Grazie a tutti quelli che l’hanno installata e hanno segnalato errori. Che venga usata ogni giorno non era scontato.</div>'
      }
    },
    {
      icon: 'palette',
      title: {
        de: 'Design-Fenster statt Blindschaltung',
        en: 'A Design window instead of blind toggles',
        fr: 'Une fenêtre Design au lieu de bascules à l’aveugle',
        it: 'Una finestra Design invece di interruttori alla cieca'
      },
      text: {
        de: 'Der Menüpunkt „Design" öffnete bisher nichts, und der Knopf in der Tab-Leiste schaltete blind durch die Themes, ohne zu zeigen, was als Nächstes kommt. Jetzt öffnet sich ein eigenes Fenster, das jedes Farbthema als kleine Nachbildung des echten Fensters und der Seite zeigt, samt Akzent-Stil. Ein Klick wirkt sofort, das Fenster färbt sich dabei selbst mit um. Der alte Knopf in der Leiste ist ausgeblendet, weil das Fenster beides übernimmt.',
        en: 'The "Design" menu entry opened nothing, and the tab bar button cycled blind through the themes without showing what was coming. It now opens a window of its own that shows each colour theme as a small mockup of the real window and page, together with the accent style. A click applies immediately and the window recolours itself along with it. The old button in the bar is hidden, since the window covers both.',
        fr: 'L’entrée de menu « Design » n’ouvrait rien et le bouton de la barre d’onglets faisait défiler les thèmes à l’aveugle, sans montrer ce qui venait ensuite. Une fenêtre dédiée présente désormais chaque thème de couleur sous forme de maquette de la vraie fenêtre et de la page, avec le style d’accent. Un clic s’applique immédiatement et la fenêtre change de couleur avec lui. L’ancien bouton de la barre est masqué, la fenêtre couvrant les deux.',
        it: 'La voce di menu "Design" non apriva nulla e il pulsante nella barra delle schede scorreva i temi alla cieca, senza mostrare cosa sarebbe arrivato. Ora si apre una finestra dedicata che mostra ogni tema colore come piccola riproduzione della finestra e della pagina reali, insieme allo stile d’accento. Un clic ha effetto subito e la finestra si ricolora insieme. Il vecchio pulsante nella barra è nascosto, perché la finestra copre entrambi.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: 'Mitternachtsblau und der Stil Neon',
        en: 'Midnight Blue and the Neon style',
        fr: 'Bleu nuit et le style Neon',
        it: 'Blu notte e lo stile Neon'
      },
      text: {
        de: 'Ein viertes Farbthema kommt dazu: tiefes Blau, dessen Abstufungen App-Fenster und claude.ai-Seite gemeinsam verwenden, mit verteilten Wellenkämmen im Hintergrund als Gegenstück zum Sternenfeld von OLED. Dazu ein dritter Akzent-Stil, Neon, in Blau. Farbthema und Stil sind ab jetzt zwei getrennte Regler und lassen sich frei kombinieren: das Thema macht die Flächen, der Stil die Akzentfarbe. Zum Stil gehört auch der Sende-Pfeil im Eingabefeld, der bisher in jedem Thema orange blieb.',
        en: 'A fourth colour theme arrives: deep blue, whose steps the app windows and the claude.ai page share, with scattered wave crests in the background as the counterpart to OLED\u2019s starfield. Alongside it a third accent style, Neon, in blue. Colour theme and style are two separate dials now and combine freely: the theme paints the surfaces, the style sets the accent colour. That includes the send arrow in the input field, which used to stay orange in every theme.',
        fr: 'Un quatrième thème de couleur arrive : un bleu profond dont les nuances sont partagées par les fenêtres de l’application et la page claude.ai, avec des crêtes de vagues réparties en arrière-plan, pendant du champ d’étoiles d’OLED. S’y ajoute un troisième style d’accent, Neon, en bleu. Thème et style sont désormais deux réglages distincts et se combinent librement : le thème peint les surfaces, le style définit la couleur d’accent. Cela vaut aussi pour la flèche d’envoi, qui restait orange dans tous les thèmes.',
        it: 'Arriva un quarto tema colore: un blu profondo, le cui gradazioni sono condivise dalle finestre dell’app e dalla pagina di claude.ai, con creste d’onda distribuite sullo sfondo come controparte del campo stellato di OLED. Si aggiunge un terzo stile d’accento, Neon, in blu. Tema colore e stile sono ora due regolazioni separate e si combinano liberamente: il tema dipinge le superfici, lo stile imposta il colore d’accento. Questo vale anche per la freccia di invio, che prima restava arancione in ogni tema.'
      }
    },
    {
      icon: 'bug',
      title: {
        de: 'Farbreste an mehreren Stellen behoben',
        en: 'Colouring leftovers fixed in several places',
        fr: 'Restes de coloration corrigés à plusieurs endroits',
        it: 'Residui di colorazione corretti in più punti'
      },
      text: {
        de: 'Der Rahmen um das Eingabefeld saß neben dessen Ecken, weil er die Rundung an der falschen Stelle gemessen hat. Auf den Seiten Code und Design blieben graue Balken stehen, dort halten die Übergangsstreifen von claude.ai ihren eigenen Grauton fest. Im hellen Thema war die untere Hälfte der Design-Seite schwarz. Und beim Wechsel behielt ein Symbol die Farbe des vorigen Themas, etwa der Stern in der Begrüßung. Zusätzlich passt sich das Fenster für Fehlerberichte an die Bildschirmgröße an, statt auf Full HD den ganzen Schirm zu füllen.',
        en: 'The ring around the input field sat next to its corners, because it measured the rounding in the wrong place. Grey bars stayed on the Code and Design pages, where claude.ai\u2019s fade strips keep their own shade of grey. In the light theme the lower half of the design page was black. And on a switch an icon kept the previous theme\u2019s colour, the star in the greeting for instance. The bug report window also adapts to the screen size now instead of filling a Full HD display entirely.',
        fr: 'L’anneau autour du champ de saisie se plaçait à côté de ses coins, car il mesurait l’arrondi au mauvais endroit. Des barres grises subsistaient sur les pages Code et Design, où les bandes de fondu de claude.ai conservent leur propre gris. Dans le thème clair, la moitié inférieure de la page Design était noire. Et lors d’un changement, une icône gardait la couleur du thème précédent, par exemple l’étoile de l’accueil. La fenêtre de rapport de bogue s’adapte en outre à la taille de l’écran au lieu de remplir tout un écran Full HD.',
        it: 'L’anello attorno al campo di input si posizionava accanto ai suoi angoli, perché misurava l’arrotondamento nel punto sbagliato. Sulle pagine Code e Design restavano barre grigie, dove le strisce di sfumatura di claude.ai mantengono il proprio grigio. Nel tema chiaro la metà inferiore della pagina Design era nera. E al cambio un’icona conservava il colore del tema precedente, ad esempio la stella nel saluto. Inoltre la finestra di segnalazione si adatta alla dimensione dello schermo invece di riempire per intero un display Full HD.'
      }
    },
    {
      icon: 'info',
      title: {
        de: 'Die App heißt jetzt Desktop for Claude',
        en: 'The app is now called Desktop for Claude',
        fr: 'L’application s’appelle désormais Desktop for Claude',
        it: 'L’app ora si chiama Desktop for Claude'
      },
      text: {
        de: 'Anthropic liefert seit Ende Juni eine eigene Claude-App für Linux aus. Damit klar bleibt, wer was gebaut hat, heißt diese App nicht mehr wie deren Produkt: sie verweist auf Claude, statt sich so zu nennen. Nur der angezeigte Name ändert sich. Chats, Login, Einstellungen und der Update-Pfad bleiben, wo sie sind, ein Neuanmelden ist nicht nötig.',
        en: 'Anthropic has been shipping its own Claude app for Linux since the end of June. To keep it clear who built what, this app no longer carries the same name as their product: it points to Claude instead of calling itself that. Only the displayed name changes. Chats, login, settings and the update path stay where they are, and there is no need to sign in again.',
        fr: 'Anthropic distribue sa propre application Claude pour Linux depuis fin juin. Pour que l’on sache qui a construit quoi, cette application ne porte plus le même nom que leur produit : elle renvoie à Claude au lieu de s’appeler ainsi. Seul le nom affiché change. Les conversations, la connexion, les réglages et le chemin de mise à jour restent en place, aucune reconnexion n’est nécessaire.',
        it: 'Da fine giugno Anthropic distribuisce una propria app Claude per Linux. Per rendere chiaro chi ha costruito cosa, questa app non porta più lo stesso nome del loro prodotto: rimanda a Claude invece di chiamarsi così. Cambia solo il nome visualizzato. Chat, accesso, impostazioni e percorso di aggiornamento restano dove sono e non serve accedere di nuovo.'
      }
    }
  ],
  '1.4.15': [
    {
      icon: 'bug',
      title: {
        de: 'Abo-Kauf war nicht möglich',
        en: 'Buying a subscription was impossible',
        fr: 'L’achat d’un abonnement était impossible',
        it: 'L’acquisto di un abbonamento era impossibile'
      },
      text: {
        de: 'Wer auf Upgrade klickte und einen Plan auswählte, sah nur noch pulsierende Platzhalter statt des Bezahlformulars. claude.ai wickelt die Bezahlung über Stripe ab, das seine Eingabefelder in eigene, eingebettete Bereiche legt. Der Schutz, der fremde eingebettete Inhalte in der App fernhält, hat diese Bereiche allesamt abgewiesen, und zwar ohne jede Fehlermeldung, weshalb die Seite endlos weiterlud. Die Adressen, die der Bezahlvorgang wirklich braucht, sind jetzt zugelassen, aber nur auf claude.ai selbst und ohne dass die App in diesen Bereichen etwas verändert. Auch Google Pay war betroffen und steht wieder zur Verfügung.',
        en: 'Clicking Upgrade and picking a plan left you with pulsing placeholders instead of the payment form. claude.ai handles payment through Stripe, which puts its input fields into its own embedded areas. The protection that keeps foreign embedded content out of the app rejected all of them, and it did so without any error message, so the page kept loading forever. The addresses the checkout genuinely needs are now allowed, but only on claude.ai itself, and the app does not touch anything inside those areas. Google Pay was affected too and works again.',
        fr: 'En cliquant sur Upgrade puis en choisissant une formule, il ne restait que des espaces réservés clignotants à la place du formulaire de paiement. claude.ai gère le paiement via Stripe, qui place ses champs de saisie dans ses propres zones intégrées. La protection qui tient à l’écart les contenus intégrés externes les rejetait toutes, sans le moindre message d’erreur, si bien que la page chargeait indéfiniment. Les adresses réellement nécessaires au paiement sont désormais autorisées, uniquement sur claude.ai, et l’application ne modifie rien à l’intérieur de ces zones. Google Pay était également touché et fonctionne à nouveau.',
        it: 'Facendo clic su Upgrade e scegliendo un piano restavano solo segnaposto lampeggianti al posto del modulo di pagamento. claude.ai gestisce il pagamento tramite Stripe, che inserisce i propri campi in aree incorporate dedicate. La protezione che tiene fuori dall’app i contenuti incorporati esterni le rifiutava tutte, senza alcun messaggio di errore, per cui la pagina caricava all’infinito. Gli indirizzi realmente necessari al pagamento sono ora consentiti, solo su claude.ai, e l’app non modifica nulla all’interno di quelle aree. Era interessato anche Google Pay, che ora funziona di nuovo.'
      }
    },
    {
      icon: 'palette',
      title: {
        de: 'Falsche Farben in der Design-Ansicht',
        en: 'Wrong colours in the Design view',
        fr: 'Couleurs incorrectes dans la vue Design',
        it: 'Colori errati nella vista Design'
      },
      text: {
        de: 'Drei Fehler in der Einfärbung sind behoben. Im hellen Thema erschienen Artefakte und die Design-Ansicht als Farbnegativ, weil sie in einem eigenen eingebetteten Bereich laufen, der von der Umkehrung nicht ausgenommen war. Im OLED-Thema blieb der Teilen-Knopf unsichtbar: die App überschrieb eine Farbe von claude.ai mit dem Wert des hellen Themas, wodurch Schrift und Fläche exakt gleich hell wurden. Und im Modern-Design fielen zwei benachbarte Stufen derselben Farbpalette auf denselben Rotton zusammen, sodass sich Rot und Orange nicht mehr unterscheiden ließen.',
        en: 'Three colouring bugs are fixed. In the light theme, artifacts and the Design view appeared as a colour negative, because they run in their own embedded area that was not excluded from the inversion. In the OLED theme the Share button stayed invisible: the app overrode one of claude.ai’s colours with the light theme’s value, leaving text and surface at exactly the same brightness. And in the Modern design, two neighbouring steps of the same palette collapsed onto one shade of red, so red and orange could no longer be told apart.',
        fr: 'Trois erreurs de coloration sont corrigées. Dans le thème clair, les artefacts et la vue Design apparaissaient en négatif, car ils s’exécutent dans une zone intégrée qui n’était pas exclue de l’inversion. Dans le thème OLED, le bouton Partager restait invisible : l’application remplaçait une couleur de claude.ai par la valeur du thème clair, si bien que le texte et le fond avaient exactement la même luminosité. Et dans le design Modern, deux paliers voisins de la même palette se confondaient en une seule nuance de rouge, rendant le rouge et l’orange impossibles à distinguer.',
        it: 'Corretti tre errori di colorazione. Nel tema chiaro gli artefatti e la vista Design apparivano come negativo, perché vengono eseguiti in un’area incorporata che non era esclusa dall’inversione. Nel tema OLED il pulsante Condividi restava invisibile: l’app sovrascriveva un colore di claude.ai con il valore del tema chiaro, lasciando testo e sfondo esattamente alla stessa luminosità. E nel design Modern due livelli vicini della stessa palette si riducevano a un’unica tonalità di rosso, rendendo rosso e arancione indistinguibili.'
      }
    }
  ],
  '1.4.14': [
    {
      icon: 'bug',
      title: {
        de: 'Schwarze Chatfläche an der Wurzel behoben',
        en: 'Black chat area fixed at the root',
        fr: 'Zone de discussion noire corrigée à la racine',
        it: 'Area chat nera risolta alla radice'
      },
      text: {
        de: 'Der Auslöser war die Bremse für Hintergrund-Tabs: solange sie für den sichtbaren Tab abgeschaltet war, waren sich App und Anzeige uneinig darüber, ob der Chat gerade sichtbar ist. Beim Zurückwechseln forderte dann niemand mehr ein neues Bild an, und die Fläche blieb auf ihrer Hintergrundfarbe stehen, im OLED-Theme also schwarz. Die Bremse wird nicht mehr von Hand gesteuert; Hintergrund-Tabs werden weiterhin gedrosselt, das übernimmt jetzt die eingebaute Automatik.',
        en: 'The trigger was the throttle for background tabs: while it was switched off for the visible tab, the app and the display disagreed about whether the chat was visible. On the way back nobody asked for a new picture, so the area kept showing its background colour, which in the OLED theme is black. The throttle is no longer steered by hand; background tabs are still throttled, that is now handled automatically.',
        fr: 'Le déclencheur était la limitation des onglets en arrière-plan : tant qu’elle était désactivée pour l’onglet visible, l’application et l’affichage n’étaient pas d’accord sur la visibilité de la discussion. Au retour, plus personne ne demandait de nouvelle image et la zone restait sur sa couleur de fond, donc noire dans le thème OLED. La limitation n’est plus pilotée à la main ; les onglets en arrière-plan restent ralentis, c’est désormais automatique.',
        it: 'La causa era la limitazione delle schede in secondo piano: finché era disattivata per la scheda visibile, app e visualizzazione non concordavano sul fatto che la chat fosse visibile. Al ritorno nessuno chiedeva più una nuova immagine e l’area restava sul suo colore di sfondo, quindi nera nel tema OLED. La limitazione non viene più gestita a mano; le schede in secondo piano restano limitate, ora in automatico.'
      }
    },
    {
      icon: 'refresh',
      title: {
        de: 'Selbstreparatur greift schneller und gibt nicht auf',
        en: 'Self-repair is quicker and does not give up',
        fr: 'La réparation automatique est plus rapide et n’abandonne pas',
        it: 'Il ripristino automatico è più rapido e non si arrende'
      },
      text: {
        de: 'Falls die Anzeige doch einmal stehen bleibt, wird das nach rund 8 statt 20 Sekunden bemerkt, und die Reparatur geht in Stufen vor, bis das Bild zurück ist, statt denselben wirkungslosen Versuch zu wiederholen. Die letzte Stufe hängt die Chatansicht neu ein, ohne die Seite neu zu laden. Zusätzlich zeigt „Diagnose-Info kopieren" jetzt, wie oft repariert werden musste, was einen Fehlerbericht dazu deutlich brauchbarer macht.',
        en: 'If the display does stall, it is now noticed after about 8 seconds instead of 20, and the repair escalates until the picture is back instead of repeating one attempt that did not work. The last step re-attaches the chat view without reloading the page. "Copy diagnostics info" now also reports how often a repair was needed, which makes a bug report about it far more useful.',
        fr: 'Si l’affichage se fige malgré tout, cela est détecté après environ 8 secondes au lieu de 20, et la réparation monte en puissance jusqu’au retour de l’image au lieu de répéter une tentative sans effet. La dernière étape rattache la vue de discussion sans recharger la page. « Copier les infos de diagnostic » indique désormais combien de réparations ont été nécessaires, ce qui rend un rapport de bogue bien plus utile.',
        it: 'Se la visualizzazione dovesse comunque bloccarsi, ora viene rilevato dopo circa 8 secondi invece di 20 e il ripristino procede per gradi finché l’immagine non torna, invece di ripetere un tentativo inefficace. L’ultimo passo riaggancia la vista della chat senza ricaricare la pagina. Inoltre "Copia informazioni di diagnostica" mostra quante riparazioni sono state necessarie, il che rende molto più utile una segnalazione.'
      }
    }
  ],
  '1.4.13': [
    {
      icon: 'refresh',
      title: {
        de: 'Schwarze Chatfläche repariert sich selbst',
        en: 'Blank chat area repairs itself',
        fr: 'La zone de discussion noire se répare d’elle-même',
        it: 'L’area chat nera si ripristina da sola'
      },
      text: {
        de: 'Auf manchen Systemen blieb der Chatbereich nach einer Weile schwarz, während die Tab-Leiste normal weiterlief; erst ein Tabwechsel baute die Seite neu auf. Die App erkennt diesen Zustand jetzt selbst und zeichnet die Anzeige nach rund 20 Sekunden neu. Zusätzlich wird nachgezeichnet, wenn das Fenster auf einen anderen Monitor wandert, sich die Bildschirmkonfiguration ändert oder der Bildschirm aus dem Ruhezustand kommt.',
        en: 'On some systems the chat area went black after a while, while the tab bar kept working normally, and only switching tabs rebuilt the page. The app now detects that state on its own and redraws the display within about 20 seconds. It also redraws when the window moves to another monitor, when the display configuration changes, and after the screen wakes up.',
        fr: 'Sur certains systèmes, la zone de discussion devenait noire au bout d’un moment, alors que la barre d’onglets continuait de fonctionner normalement ; seul un changement d’onglet reconstruisait la page. L’application détecte désormais cet état d’elle-même et redessine l’affichage en 20 secondes environ. Elle redessine également lorsque la fenêtre passe sur un autre écran, lorsque la configuration d’affichage change et après le réveil de l’écran.',
        it: 'Su alcuni sistemi l’area chat diventava nera dopo un po’, mentre la barra delle schede continuava a funzionare normalmente; solo cambiando scheda la pagina veniva ricostruita. L’app ora rileva da sola questo stato e ridisegna la visualizzazione entro circa 20 secondi. Ridisegna anche quando la finestra passa su un altro monitor, quando cambia la configurazione dello schermo e dopo il risveglio dello schermo.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: 'Hintergrund-Tabs bremsen nicht mehr',
        en: 'Background tabs no longer slow things down',
        fr: 'Les onglets en arrière-plan ne ralentissent plus',
        it: 'Le schede in secondo piano non rallentano più'
      },
      text: {
        de: 'Tabs im Hintergrund sollten gedrosselt werden, wurden es aber nie: die Drosselung wurde erst nach dem Ausblenden gesetzt und blieb dadurch wirkungslos. Jeder einmal geöffnete Tab rechnete unsichtbar mit voller Last weiter. Gemessen halbiert sich die Prozessorlast bei drei Hintergrund-Tabs. Im OLED-Theme fiel das am stärksten ins Gewicht, weil dort eine dauerhafte Animation am Eingabefeld läuft.',
        en: 'Background tabs were supposed to be throttled but never were: the throttle was applied after hiding the tab, which made it a no-op. Every tab you had opened kept rendering at full cost while invisible. Measured, processor load halves with three background tabs. This weighed most in the OLED theme, where a permanent animation runs on the input field.',
        fr: 'Les onglets en arrière-plan devaient être ralentis, mais ne l’étaient jamais : la limitation était appliquée après le masquage et restait donc sans effet. Chaque onglet déjà ouvert continuait de calculer à pleine charge sans être visible. Mesurée, la charge du processeur est divisée par deux avec trois onglets en arrière-plan. C’était le plus pénalisant dans le thème OLED, où une animation permanente tourne sur le champ de saisie.',
        it: 'Le schede in secondo piano dovevano essere limitate, ma non lo erano mai: la limitazione veniva impostata dopo aver nascosto la scheda e restava quindi inefficace. Ogni scheda già aperta continuava a calcolare a pieno carico pur non essendo visibile. Misurato, il carico del processore si dimezza con tre schede in secondo piano. Nel tema OLED pesava di più, perché lì è attiva un’animazione permanente sul campo di immissione.'
      }
    }
  ],
  '1.4.12': [
    {
      icon: 'bolt',
      title: {
        de: 'Weiß-Wechsel ohne Ruckeln',
        en: 'Switching to White no longer stutters',
        fr: 'Le passage au thème clair ne saccade plus',
        it: 'Il passaggio al tema chiaro non scatta più'
      },
      text: {
        de: 'Der Wechsel zum weißen Theme fror kurz ein, weil dafür claude.ais komplette Farbpalette auf hell umgestellt wurde und claude.ai daraufhin die Darstellung jedes sichtbaren Elements neu berechnete (gemessen rund 480 ms, unabhängig von der Chatlänge). Weiß lässt claude.ai jetzt in seiner dunklen Palette und dreht die Seite stattdessen auf der Grafikkarte um; echte Bilder werden zurückgedreht. Statt 480 ms sind es rund 6 ms, so schnell wie der Wechsel zwischen OLED und Dunkel. Weiß ist dadurch eine farbtreue Umkehrung des dunklen Themes statt claude.ais eigenem hellen Theme.',
        en: 'Switching to the White theme froze for a moment, because it flipped claude.ai\'s entire palette to light and claude.ai then recomputed the style of every visible element (measured at about 480ms, regardless of chat length). White now keeps claude.ai in its dark palette and inverts the page on the GPU instead, with real images inverted back. That is about 6ms instead of 480ms, as fast as switching between OLED and Dark. As a result White is a colour-faithful inversion of the dark theme rather than claude.ai\'s own light theme.',
        fr: 'Le passage au thème clair se figeait un instant, car il basculait toute la palette de claude.ai en clair et claude.ai recalculait alors le style de chaque élément visible (environ 480 ms mesurées, quelle que soit la longueur de la conversation). Le thème clair garde désormais claude.ai dans sa palette sombre et inverse plutôt la page sur la carte graphique ; les vraies images sont réinversées. Cela représente environ 6 ms au lieu de 480 ms, aussi rapide que le passage entre OLED et sombre. Le thème clair est ainsi une inversion fidèle des couleurs du thème sombre plutôt que le thème clair natif de claude.ai.',
        it: 'Il passaggio al tema chiaro si bloccava per un istante, perché convertiva l’intera palette di claude.ai in chiaro e claude.ai ricalcolava poi lo stile di ogni elemento visibile (circa 480 ms misurati, indipendentemente dalla lunghezza della chat). Il tema chiaro ora mantiene claude.ai nella sua palette scura e inverte invece la pagina sulla scheda grafica; le immagini reali vengono re-invertite. Sono circa 6 ms invece di 480 ms, veloce quanto il passaggio tra OLED e scuro. Di conseguenza il tema chiaro è un’inversione fedele nei colori del tema scuro anziché il tema chiaro nativo di claude.ai.'
      }
    },
    {
      icon: 'palette',
      title: {
        de: 'Theme steht sofort beim Start',
        en: 'Theme is there right at startup',
        fr: 'Le thème est là dès le démarrage',
        it: 'Il tema è pronto già all’avvio'
      },
      text: {
        de: 'Beim Kaltstart baute sich das Theme sichtbar auf: kurz war claude.ais Standard-Darstellung zu sehen, dann sprang alles auf das dunkle Theme um. Grund war, dass das vollständige Theme von einem Skript kam, das erst rund 1,7 Sekunden nach dem Laden an die Reihe kam, weil claude.ai in der Zwischenzeit den Hauptprozess belegt. Das komplette Theme wird jetzt schon vor dem ersten Bild gesetzt, sodass wiederhergestellte Inhalte gleich richtig dargestellt werden. Die kurze Nicht-Reagierbarkeit während claude.ai selbst lädt, bleibt davon unberührt.',
        en: 'On a cold start the theme visibly built up: claude.ai\'s default look flashed for a moment, then everything snapped to the dark theme. The full theme came from a script that only got its turn about 1.7 seconds into the load, because claude.ai occupies the main process until then. The complete theme is now set before the first paint, so restored content appears correct right away. The brief unresponsiveness while claude.ai itself loads is unaffected.',
        fr: 'Au démarrage à froid, le thème se construisait visiblement : l’apparence par défaut de claude.ai apparaissait un instant, puis tout basculait vers le thème sombre. Le thème complet venait d’un script qui n’intervenait qu’environ 1,7 seconde après le chargement, car claude.ai occupe le processus principal jusque-là. Le thème complet est désormais appliqué avant le premier rendu, si bien que le contenu restauré s’affiche correctement d’emblée. La brève absence de réponse pendant que claude.ai se charge n’est pas concernée.',
        it: 'All’avvio a freddo il tema si costruiva visibilmente: per un istante compariva l’aspetto predefinito di claude.ai, poi tutto passava al tema scuro. Il tema completo proveniva da uno script che entrava in gioco solo circa 1,7 secondi dopo il caricamento, perché claude.ai occupa il processo principale fino ad allora. Il tema completo viene ora impostato prima del primo disegno, così i contenuti ripristinati appaiono subito corretti. La breve mancanza di risposta mentre claude.ai stesso si carica non è interessata.'
      }
    },
    {
      icon: 'refresh',
      title: {
        de: 'Flüssigeres Rendern des Themes',
        en: 'Smoother theme rendering',
        fr: 'Rendu du thème plus fluide',
        it: 'Rendering del tema più fluido'
      },
      text: {
        de: 'Im OLED-Modus wurde das Sternenfeld hinter offenen Dialogen über einen aufwändigen CSS-Selektor ausgeblendet, den der Browser bei jeder Änderung an der Seite neu auswerten musste. Während eine Antwort entsteht, ändert claude.ai die Seite viele Male pro Sekunde, wodurch das ständig lief und die Darstellung träge wirken ließ. Das Ausblenden läuft jetzt über einen leichtgewichtigen Schalter, der messbar keine Zusatzkosten pro Änderung verursacht.',
        en: 'In OLED mode the starfield behind open dialogs was hidden with an expensive CSS selector that the browser had to re-evaluate on every change to the page. While a response is being written, claude.ai changes the page many times per second, so this ran constantly and made the display feel sluggish. The hiding now uses a lightweight switch that measurably adds no cost per change.',
        fr: 'En mode OLED, le champ d’étoiles derrière les dialogues ouverts était masqué par un sélecteur CSS coûteux que le navigateur devait réévaluer à chaque changement de la page. Pendant qu’une réponse s’écrit, claude.ai modifie la page de nombreuses fois par seconde, ce qui s’exécutait en permanence et rendait l’affichage lent. Le masquage utilise désormais un commutateur léger qui, d’après les mesures, n’ajoute aucun coût par changement.',
        it: 'In modalità OLED il campo stellare dietro le finestre di dialogo aperte veniva nascosto con un selettore CSS costoso che il browser doveva rivalutare a ogni modifica della pagina. Mentre una risposta viene scritta, claude.ai modifica la pagina molte volte al secondo, quindi ciò veniva eseguito di continuo e rendeva la visualizzazione lenta. Ora l’occultamento usa un interruttore leggero che, secondo le misurazioni, non aggiunge alcun costo per modifica.'
      }
    }
  ],
  '1.4.11': [
    {
      icon: 'palette',
      title: {
        de: 'Farbige Brand-Symbole statt grauer',
        en: 'Brand icons are coloured again',
        fr: 'Les icônes de marque retrouvent leur couleur',
        it: 'Le icone del marchio tornano colorate'
      },
      text: {
        de: 'Im Design "Modern" mit Dunkel- oder OLED-Modus wurde der Stern über der Begrüßung und andere Akzent-Symbole grau statt farbig dargestellt. Ursache war die Umfärbung der Marken-Farbe: claude.ai erwartet an dieser Stelle keinen fertigen Farbwert, wodurch die Farbangabe ungültig wurde und die Symbole auf die Textfarbe zurückfielen. Die Umfärbung greift jetzt direkt an der richtigen Stelle.',
        en: 'In the "Modern" design with dark or OLED mode, the spark above the greeting and other accent icons appeared grey instead of coloured. The cause was the brand colour remap: claude.ai does not expect a finished colour value there, so the declaration became invalid and the icons fell back to the text colour. The remap now applies at the right place.',
        fr: 'Dans le design « Moderne » avec le mode sombre ou OLED, l’étoile au-dessus du message d’accueil et d’autres icônes d’accentuation apparaissaient en gris au lieu d’être colorées. En cause : la recoloration de la couleur de marque, car claude.ai n’attend pas ici une valeur de couleur finie, ce qui rendait la déclaration invalide et faisait retomber les icônes sur la couleur du texte. La recoloration s’applique désormais au bon endroit.',
        it: 'Nel design "Moderno" con modalità scura o OLED, la stella sopra il saluto e altre icone di accento apparivano grigie invece che colorate. La causa era la ricolorazione del colore del marchio: claude.ai non si aspetta lì un valore di colore già pronto, quindi la dichiarazione diventava non valida e le icone ripiegavano sul colore del testo. Ora la ricolorazione agisce nel punto giusto.'
      }
    },
    {
      icon: 'refresh',
      title: {
        de: 'Offene Tabs überleben den Neustart',
        en: 'Open tabs survive a restart',
        fr: 'Les onglets ouverts survivent au redémarrage',
        it: 'Le schede aperte sopravvivono al riavvio'
      },
      text: {
        de: 'Die App merkt sich jetzt, welche Unterhaltungen offen waren, und stellt sie beim nächsten Start wieder her. Die zusätzlichen Tabs laden erst beim Anklicken, damit der Start nicht ausgebremst wird.',
        en: 'The app now remembers which conversations were open and restores them on the next start. Additional tabs only load when you click them, so startup stays fast.',
        fr: 'L’application retient désormais les conversations ouvertes et les restaure au démarrage suivant. Les onglets supplémentaires ne se chargent qu’au clic, pour ne pas ralentir le démarrage.',
        it: 'L’app ora ricorda quali conversazioni erano aperte e le ripristina al successivo avvio. Le schede aggiuntive si caricano solo al clic, così l’avvio resta veloce.'
      }
    },
    {
      icon: 'bug',
      title: {
        de: 'Nach Verbindungsabbruch zurück in die richtige Unterhaltung',
        en: 'Back to the right conversation after a dropout',
        fr: 'Retour à la bonne conversation après une coupure',
        it: 'Ritorno alla conversazione giusta dopo una disconnessione'
      },
      text: {
        de: 'Brach die Verbindung ab, landete man danach in einem neuen Chat statt in der vorherigen Unterhaltung, und Tabs im Hintergrund blieben dauerhaft auf der Offline-Seite hängen. Die App merkt sich jetzt pro Tab die geöffnete Unterhaltung und kehrt beim Wiederverbinden dorthin zurück, auch über mehrere Tabs hinweg. Der Status wird außerdem sofort beim Zurückwechseln zum Fenster geprüft statt erst nach bis zu einer Minute.',
        en: 'After a connection dropout you ended up in a new chat instead of the previous conversation, and background tabs stayed stuck on the offline page for good. The app now remembers the open conversation per tab and returns to it when the connection comes back, across multiple tabs. The status is also checked as soon as you switch back to the window, instead of after up to a minute.',
        fr: 'Après une coupure de connexion, vous vous retrouviez dans une nouvelle conversation au lieu de la précédente, et les onglets en arrière-plan restaient bloqués sur la page hors ligne. L’application retient désormais la conversation ouverte pour chaque onglet et y revient au rétablissement de la connexion, sur plusieurs onglets. L’état est également vérifié dès que vous revenez sur la fenêtre, au lieu d’attendre jusqu’à une minute.',
        it: 'Dopo una disconnessione finivi in una nuova chat invece che nella conversazione precedente, e le schede in secondo piano restavano bloccate sulla pagina offline. L’app ora ricorda la conversazione aperta per ogni scheda e vi ritorna al ripristino della connessione, anche su più schede. Lo stato viene inoltre verificato appena torni sulla finestra, invece che dopo fino a un minuto.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: 'Neu zeichnen bei leerem Chatbereich',
        en: 'Redraw for a blank chat area',
        fr: 'Redessiner en cas de zone de discussion vide',
        it: 'Ridisegna in caso di area chat vuota'
      },
      text: {
        de: 'Auf manchen Systemen bleibt der Chatbereich gelegentlich leer, bis man den Tab wechselt. Im Menü "Ansicht" gibt es dafür jetzt "Neu zeichnen" (Strg+Alt+R), das die Anzeige ohne Tabwechsel wiederherstellt. Zusätzlich wurde eine Drosselung behoben, durch die ein Tab nach dem Minimieren bei niedriger Bildrate hängen bleiben konnte.',
        en: 'On some systems the chat area occasionally stays blank until you switch tabs. The View menu now has a "Redraw" entry (Ctrl+Alt+R) that restores the display without switching tabs. A throttling bug was also fixed that could leave a tab stuck at a low frame rate after minimizing.',
        fr: 'Sur certains systèmes, la zone de discussion reste parfois vide jusqu’à ce que vous changiez d’onglet. Le menu « Affichage » propose désormais « Redessiner » (Ctrl+Alt+R), qui rétablit l’affichage sans changer d’onglet. Un problème de limitation a également été corrigé, qui pouvait laisser un onglet bloqué à faible fréquence d’images après réduction.',
        it: 'Su alcuni sistemi l’area chat resta a volte vuota finché non cambi scheda. Nel menu "Visualizza" ora c’è "Ridisegna" (Ctrl+Alt+R), che ripristina la visualizzazione senza cambiare scheda. È stato inoltre corretto un problema di limitazione che poteva lasciare una scheda bloccata a bassa frequenza di fotogrammi dopo la riduzione a icona.'
      }
    },
    {
      icon: 'palette',
      title: {
        de: 'Seitenleiste bleibt im OLED-Modus sichtbar',
        en: 'Sidebar stays visible in OLED mode',
        fr: 'La barre latérale reste visible en mode OLED',
        it: 'La barra laterale resta visibile in modalità OLED'
      },
      text: {
        de: 'Im OLED-Modus konnte die Seitenleiste beim Laden mit dem gleich schwarzen Chatbereich verschmelzen und dadurch unsichtbar wirken. Die feine Trennlinie wird jetzt schon vor dem ersten Bild gesetzt, nicht erst danach. Außerdem blitzen Vorschau-Fenster für Code und Design nicht mehr weiß auf.',
        en: 'In OLED mode the sidebar could blend into the equally black chat area while loading and appear to be gone. The thin divider is now applied before the first paint instead of after. Preview windows for code and design also no longer flash white.',
        fr: 'En mode OLED, la barre latérale pouvait se fondre dans la zone de discussion tout aussi noire pendant le chargement et sembler avoir disparu. Le fin séparateur est désormais appliqué avant le premier rendu, et non après. Les fenêtres d’aperçu pour le code et le design ne clignotent plus en blanc.',
        it: 'In modalità OLED la barra laterale poteva confondersi con l’area chat altrettanto nera durante il caricamento e sembrare scomparsa. Il sottile separatore viene ora applicato prima del primo disegno, non dopo. Inoltre le finestre di anteprima per codice e design non lampeggiano più in bianco.'
      }
    }
  ],
  '1.4.10': [
    {
      icon: 'check',
      title: {
        de: 'Fehler melden: klarer vom Anthropic-Support getrennt',
        en: 'Bug Report: clearer separation from Anthropic support',
        fr: 'Signaler un bug : séparation plus nette du support Anthropic',
        it: 'Segnala un bug: separazione più netta dal supporto Anthropic'
      },
      text: {
        de: 'Immer wieder landeten Account-, Login- und Bezahl-Anfragen im Fehler-melden-Fenster, obwohl das nur Anthropic lösen kann. Der Hinweis sagt jetzt deutlich, dass die Nachricht an einen einzelnen freiwilligen Entwickler geht, nicht an Anthropic. Vor dem Absenden bestätigt man zusätzlich mit einem Häkchen, dass es wirklich um die Linux-App selbst geht.',
        en: 'Account, login and billing requests kept landing in the Bug Report window, even though only Anthropic can solve those. The notice now states clearly that the message goes to a single volunteer developer, not to Anthropic. Before sending, a checkbox also asks you to confirm the issue really is about the Linux app itself.',
        fr: 'Des demandes de compte, de connexion et de facturation arrivaient sans cesse dans la fenêtre de signalement, alors que seul Anthropic peut les résoudre. Le message indique désormais clairement qu’il est envoyé à un développeur bénévole, pas à Anthropic. Avant l’envoi, une case à cocher vous demande aussi de confirmer qu’il s’agit bien de l’application Linux elle-même.',
        it: 'Richieste di account, accesso e pagamento continuavano ad arrivare nella finestra di segnalazione, anche se solo Anthropic può risolverle. L’avviso ora indica chiaramente che il messaggio va a un singolo sviluppatore volontario, non ad Anthropic. Prima dell’invio, una casella di spunta ti chiede inoltre di confermare che si tratta davvero dell’app Linux stessa.'
      }
    },
    {
      icon: 'bell',
      title: {
        de: 'Sanfter Hinweis bei Account- oder Bezahl-Themen',
        en: 'Gentle hint on account or billing topics',
        fr: 'Indication discrète pour les sujets compte ou paiement',
        it: 'Suggerimento discreto per temi di account o pagamento'
      },
      text: {
        de: 'Klingt die Beschreibung nach Login, Passwort, Abo oder Rechnung, blendet das Formular jetzt live einen kurzen Hinweis mit Link zum Anthropic-Support ein. Das ist nur ein Hinweis, absenden lässt sich der Bericht trotzdem.',
        en: 'If the description sounds like login, password, subscription or billing, the form now shows a short inline hint with a link to Anthropic support. It is only a hint, you can still send the report.',
        fr: 'Si la description évoque une connexion, un mot de passe, un abonnement ou une facturation, le formulaire affiche désormais en direct une courte note avec un lien vers le support Anthropic. Ce n’est qu’une indication, vous pouvez quand même envoyer le rapport.',
        it: 'Se la descrizione richiama accesso, password, abbonamento o fatturazione, il modulo mostra ora al volo una breve nota con un link al supporto Anthropic. È solo un suggerimento, puoi comunque inviare la segnalazione.'
      }
    }
  ],
  '1.4.9': [
    {
      icon: 'refresh',
      title: {
        de: 'OLED: schwarze Balken auf der Bezahlseite behoben',
        en: 'OLED: black bars on the checkout page fixed',
        fr: 'OLED : bandes noires corrigées sur la page de paiement',
        it: 'OLED: barre nere corrette nella pagina di pagamento'
      },
      text: {
        de: 'Auf der Upgrade-/Bezahlseite färbte der OLED-Modus auch helle Preis-Chips komplett schwarz. Die Erkennung unterschied eine helle Tönung (z.B. 5% Deckkraft) nicht von der voll deckenden Variante desselben Tokens, wodurch der für hellen Hintergrund gedachte dunkle Text darauf unlesbar wurde. Getönte Varianten werden jetzt gezielt ausgenommen.',
        en: 'On the upgrade/checkout page, OLED mode also painted light price chips fully black. The detection did not distinguish a light tint (e.g. 5% opacity) from the fully opaque variant of the same token, making the dark text meant for a light background unreadable. Tinted variants are now specifically excluded.',
        fr: 'Sur la page de mise à niveau/paiement, le mode OLED peignait aussi en noir plein des puces de prix claires. La détection ne distinguait pas une teinte claire (par ex. 5% d’opacité) de la variante entièrement opaque du même token, rendant illisible le texte sombre prévu pour un fond clair. Les variantes teintées sont désormais exclues spécifiquement.',
        it: 'Nella pagina di aggiornamento/pagamento, la modalità OLED colorava di nero anche i chip di prezzo chiari. Il rilevamento non distingueva una tinta chiara (per es. 5% di opacità) dalla variante completamente opaca dello stesso token, rendendo illeggibile il testo scuro pensato per uno sfondo chiaro. Le varianti tinteggiate ora vengono escluse specificamente.'
      }
    },
    {
      icon: 'palette',
      title: {
        de: 'Classic/Modern-Umfärbung: modernere Farbwerte erkannt',
        en: 'Classic/Modern recolor: modern color values now recognized',
        fr: 'Recoloration Classic/Modern : valeurs de couleur modernes reconnues',
        it: 'Ricolorazione Classic/Modern: valori di colore moderni riconosciuti'
      },
      text: {
        de: 'Beim Umschalten zwischen Classic und Modern wurde das Marken-Orange auf manchen Seiten nicht mehr umgefärbt, weil claude.ai Farben zunehmend über modernere CSS-Funktionen wie oklch() oder color-mix() setzt, die die bisherige Farberkennung nicht verstand. Nicht erkannte Werte werden jetzt zusätzlich über ein unsichtbares Canvas in echte Pixelfarben umgerechnet.',
        en: 'When switching between Classic and Modern, the brand orange stopped being recolored on some pages, because claude.ai increasingly sets colors through newer CSS functions like oklch() or color-mix(), which the existing color detection did not understand. Unrecognized values are now additionally converted to real pixel colors via an invisible canvas.',
        fr: 'En basculant entre Classic et Modern, l’orange de la marque n’était plus recoloré sur certaines pages, car claude.ai définit de plus en plus les couleurs via des fonctions CSS plus récentes comme oklch() ou color-mix(), que la détection de couleur existante ne comprenait pas. Les valeurs non reconnues sont désormais aussi converties en véritables couleurs de pixel via un canevas invisible.',
        it: 'Passando tra Classic e Modern, l’arancione del marchio non veniva più ricolorato in alcune pagine, perché claude.ai imposta sempre più spesso i colori tramite funzioni CSS più recenti come oklch() o color-mix(), che il rilevamento colore esistente non comprendeva. I valori non riconosciuti vengono ora convertiti anche in veri colori dei pixel tramite un canvas invisibile.'
      }
    }
  ],
  '1.4.8': [
    {
      icon: 'shield',
      image: 'whatsnew/cf-verify.png',
      title: {
        de: 'Cloudflare-Verifizierung: Browser-Kennung korrigiert',
        en: 'Cloudflare verification: browser identity fix',
        fr: 'Vérification Cloudflare : identité du navigateur corrigée',
        it: 'Verifica Cloudflare: identità del browser corretta'
      },
      text: {
        de: 'Die App meldete der Cloudflare-Sicherheitsprüfung im HTTP-Header eine Browser-Kennung ("Google Chrome"), die die JavaScript-Schnittstelle des eingebauten Browsers gar nicht bestätigt. Ein echter Browser hält beides identisch, die Abweichung war ein Bot-Signal, das die Prüfung in eine Schleife laufen lassen konnte. Header und JavaScript-Kennung stimmen jetzt überein (durchgängig Chromium). Zusätzlich wird der "Do Not Track"-Header nicht mehr gesendet, da ein normales Chrome ihn standardmäßig auch nicht sendet.',
        en: 'The app told the Cloudflare security check, in the HTTP header, a browser identity ("Google Chrome") that the JavaScript interface of the built-in browser does not confirm. A real browser keeps both identical, so the mismatch was a bot signal that could send the check into a loop. Header and JavaScript identity now match (consistent Chromium). The "Do Not Track" header is also no longer sent, since a normal Chrome does not send it by default either.',
        fr: 'L’application indiquait à la vérification de sécurité Cloudflare, dans l’en-tête HTTP, une identité de navigateur (« Google Chrome ») que l’interface JavaScript du navigateur intégré ne confirme pas. Un vrai navigateur garde les deux identiques, cet écart était un signal de bot qui pouvait faire tourner la vérification en boucle. L’en-tête et l’identité JavaScript correspondent désormais (Chromium cohérent). L’en-tête « Do Not Track » n’est plus envoyé non plus, car un Chrome normal ne l’envoie pas par défaut.',
        it: 'L’app comunicava al controllo di sicurezza di Cloudflare, nell’header HTTP, un’identità del browser ("Google Chrome") che l’interfaccia JavaScript del browser integrato non conferma. Un browser reale le mantiene identiche, quindi questa differenza era un segnale da bot che poteva mandare il controllo in un ciclo. Ora header e identità JavaScript coincidono (Chromium coerente). Inoltre l’header "Do Not Track" non viene più inviato, poiché nemmeno un normale Chrome lo invia per impostazione predefinita.'
      }
    },
    {
      icon: 'refresh',
      title: {
        de: 'Bessere Hilfe bei hängender Verifizierung',
        en: 'Better help when verification gets stuck',
        fr: 'Meilleure aide en cas de vérification bloquée',
        it: 'Aiuto migliore quando la verifica si blocca'
      },
      text: {
        de: 'Bleibt die Cloudflare-Sicherheitsprüfung in einer Schleife hängen, erklärt der Hinweis auf der Seite jetzt genauer, was hilft: Zurücksetzen leert nur Cookies und Cache und behebt nur eine veraltete Cookie-Schleife. Hängt die Prüfung weiter, liegt es an der Netzwerk-Adresse: ein aktives VPN ist oft die Ursache (für claude.ai ausschalten), sonst hilft ein anderes Netzwerk. So landet man nicht mehr beim wirkungslosen wiederholten Zurücksetzen.',
        en: 'When the Cloudflare security check is stuck in a loop, the on-page notice now explains more precisely what helps: Reset only clears cookies and cache and only fixes a stale-cookie loop. If the check keeps looping, it is your network address: an active VPN is often the cause (turn it off for claude.ai), otherwise a different network helps. No more dead-end repeated resetting.',
        fr: 'Lorsque la vérification de sécurité Cloudflare tourne en boucle, le message sur la page explique désormais plus précisément ce qui aide : la réinitialisation efface seulement les cookies et le cache et ne corrige qu’une boucle due à un cookie obsolète. Si la vérification continue de boucler, cela vient de votre adresse réseau : un VPN actif en est souvent la cause (désactivez-le pour claude.ai), sinon un autre réseau aide. Fini la réinitialisation répétée et sans effet.',
        it: 'Quando il controllo di sicurezza di Cloudflare resta bloccato in un ciclo, l’avviso sulla pagina ora spiega più precisamente cosa aiuta: la reimpostazione cancella solo cookie e cache e risolve soltanto un ciclo dovuto a un cookie obsoleto. Se il controllo continua a ripetersi, dipende dal tuo indirizzo di rete: una VPN attiva è spesso la causa (disattivala per claude.ai), altrimenti aiuta una rete diversa. Niente più reimpostazioni ripetute e inutili.'
      }
    },
    {
      icon: 'shield',
      title: {
        de: 'Reset-Knopf jetzt in der Leiste',
        en: 'Reset button now in the toolbar',
        fr: 'Bouton de réinitialisation dans la barre',
        it: 'Pulsante di reimpostazione nella barra'
      },
      text: {
        de: 'Das Zurücksetzen der Verifizierung ist jetzt direkt über ein Schild-Symbol oben in der Leiste erreichbar, nicht mehr nur versteckt im Menü. Praktisch, wenn die Cloudflare-Prüfung hängt und du schnell handeln willst.',
        en: 'Resetting verification is now reachable directly via a shield icon in the top toolbar, no longer only hidden in the menu. Handy when the Cloudflare check is stuck and you want to act fast.',
        fr: 'La réinitialisation de la vérification est désormais accessible directement via une icône bouclier dans la barre du haut, plus seulement cachée dans le menu. Pratique quand la vérification Cloudflare bloque et que vous voulez agir vite.',
        it: 'La reimpostazione della verifica è ora raggiungibile direttamente tramite un’icona scudo nella barra in alto, non più solo nascosta nel menu. Utile quando il controllo Cloudflare si blocca e vuoi agire in fretta.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: 'Neugestaltetes „Was ist neu“-Fenster',
        en: 'Redesigned update window',
        fr: 'Fenêtre des nouveautés repensée',
        it: 'Finestra delle novità ridisegnata'
      },
      text: {
        de: 'Die Update-Übersicht ist jetzt eine kleine Diashow: ein Punkt pro Neuerung, zum Durchklicken mit Weiter/Zurück, den Punkten oder den Pfeiltasten, dazu eine dezente Animation und Platz für ein Bild. Du liest sie gerade.',
        en: 'The update overview is now a small slideshow: one slide per change, click through with next/back, the dots or the arrow keys, with a subtle animation and room for an image. You are reading it right now.',
        fr: 'L’aperçu des mises à jour est désormais un petit diaporama : une diapositive par nouveauté, à parcourir avec suivant/retour, les points ou les flèches, avec une animation discrète et de la place pour une image. Vous êtes en train de le lire.',
        it: 'La panoramica degli aggiornamenti ora è una piccola presentazione: una diapositiva per novità, da sfogliare con avanti/indietro, i punti o le frecce, con un’animazione discreta e spazio per un’immagine. La stai leggendo proprio ora.'
      }
    }
  ],
  '1.4.7': [
    {
      icon: 'bolt',
      title: {
        de: 'OLED-Modus aufpoliert',
        en: 'OLED mode polished',
        fr: 'Mode OLED peaufiné',
        it: 'Modalità OLED rifinita'
      },
      text: {
        de: 'Im OLED-Modus waren dunkle Flächen kaum voneinander zu unterscheiden. Menüs, Karten und Dialoge haben jetzt feine Trennlinien, die Seitenleiste ist klar vom Chat abgegrenzt, und der Fokusrahmen um Eingabefelder ist dezenter. Neu ist ein zurückhaltender Rahmen um das Fenster und die Dialoge, oben etwas heller und nach unten dunkler werdend, der sich dem Theme anpasst. Der Schließen-Button übernimmt jetzt die Akzentfarbe des gewählten Designs.',
        en: 'In OLED mode, dark areas were hard to tell apart. Menus, cards and dialogs now have thin separator lines, the sidebar is clearly set off from the chat, and the focus ring around input fields is more subtle. There is also a restrained frame around the window and dialogs, a little lighter at the top and darker toward the bottom, that adapts to the theme. The close button now takes on the accent color of the selected design.',
        fr: 'En mode OLED, les zones sombres étaient difficiles à distinguer. Les menus, cartes et boîtes de dialogue ont désormais de fines lignes de séparation, la barre latérale se détache nettement du chat, et le contour de focus autour des champs de saisie est plus discret. Un cadre sobre entoure également la fenêtre et les boîtes de dialogue, un peu plus clair en haut et plus sombre vers le bas, et s’adapte au thème. Le bouton de fermeture reprend maintenant la couleur d’accent du design choisi.',
        it: 'In modalità OLED le aree scure erano difficili da distinguere. Menu, schede e finestre di dialogo ora hanno sottili linee di separazione, la barra laterale si stacca nettamente dalla chat e il contorno di focus attorno ai campi di immissione è più discreto. È stata aggiunta anche una cornice sobria attorno alla finestra e alle finestre di dialogo, un po’ più chiara in alto e più scura verso il basso, che si adatta al tema. Il pulsante di chiusura ora assume il colore d’accento del design scelto.'
      }
    },
    {
      icon: 'settings',
      title: {
        de: 'Einstellungsfenster im Dunkelmodus',
        en: 'Settings window in dark mode',
        fr: 'Fenêtre des paramètres en mode sombre',
        it: 'Finestra delle impostazioni in modalità scura'
      },
      text: {
        de: 'Im OLED-Modus war im Einstellungsfenster eine helle graue Fläche neben der dunklen Seitenleiste zu sehen, und die Sterne des Hintergrunds schimmerten durch. Die Fläche ist jetzt durchgehend dunkel, die Sterne werden ausgeblendet, solange ein Fenster im Vordergrund liegt, und das Suchfeld wirkt ruhiger.',
        en: 'In OLED mode the settings window showed a light gray area next to the dark sidebar, and the background stars shimmered through. The area is now uniformly dark, the stars are hidden while a dialog is open, and the search field looks calmer.',
        fr: 'En mode OLED, la fenêtre des paramètres affichait une zone gris clair à côté de la barre latérale sombre, et les étoiles de l’arrière-plan transparaissaient. La zone est désormais uniformément sombre, les étoiles sont masquées tant qu’une boîte de dialogue est ouverte, et le champ de recherche paraît plus calme.',
        it: 'In modalità OLED la finestra delle impostazioni mostrava un’area grigio chiaro accanto alla barra laterale scura e le stelle dello sfondo trasparivano. Ora l’area è uniformemente scura, le stelle vengono nascoste finché una finestra di dialogo è aperta e il campo di ricerca appare più tranquillo.'
      }
    },
    {
      icon: 'refresh',
      title: {
        de: 'Schwarzes Fenster beim geteilten Bildschirm',
        en: 'Black window when tiling',
        fr: 'Fenêtre noire en écran partagé',
        it: 'Finestra nera a schermo diviso'
      },
      text: {
        de: 'Auf einer Bildschirmhälfte (Tiling) konnte das Fenster komplett schwarz bleiben, nur die Titelleiste war sichtbar. Nach dem Ändern der Fenstergröße erzwingt die App jetzt eine Neuzeichnung, sodass der Inhalt zuverlässig wieder erscheint.',
        en: 'When tiled to half the screen, the window could turn fully black with only the title bar showing. After a resize, the app now forces a redraw so the content reliably comes back.',
        fr: 'Placée sur une moitié d’écran (tiling), la fenêtre pouvait devenir entièrement noire, seule la barre de titre restant visible. Après un redimensionnement, l’application force désormais un nouveau rendu pour que le contenu réapparaisse de façon fiable.',
        it: 'Affiancata a metà schermo (tiling), la finestra poteva diventare completamente nera, con solo la barra del titolo visibile. Dopo un ridimensionamento, l’app forza ora un nuovo disegno così che il contenuto riappaia in modo affidabile.'
      }
    }
  ],
  '1.4.6': [
    {
      icon: 'shield',
      title: {
        de: 'Weniger Absturz-Dialoge',
        en: 'Fewer crash pop-ups',
        fr: 'Moins de fenêtres d’erreur',
        it: 'Meno finestre di errore'
      },
      text: {
        de: 'Auf der Snap-Version konnte unvermittelt das Fenster „A JavaScript error occurred in the main process" erscheinen. Auslöser war die Hintergrund-Update-Prüfung, die in eine geschlossene Log-Leitung schrieb. Das stürzt die App nicht mehr ab. Im Snap läuft der eingebaute Updater jetzt gar nicht mehr, da der Snap Store die Updates übernimmt. Auch weitere seltene Absturzquellen (externe Links öffnen, Benachrichtigungen unter striktem Snap-Confinement) werden jetzt abgefangen.',
        en: 'On the Snap build an "A JavaScript error occurred in the main process" window could appear out of nowhere. It came from the background update check writing to a closed log pipe. That no longer crashes the app, and on Snap the built-in updater no longer runs at all, since the Snap Store handles updates. Other rare crash sources (opening external links, notifications under strict Snap confinement) are now caught too.',
        fr: 'Sur la version Snap, une fenêtre « A JavaScript error occurred in the main process » pouvait surgir sans raison. Elle venait de la vérification des mises à jour en arrière-plan qui écrivait dans un canal de log fermé. Cela ne fait plus planter l’application, et sur Snap le programme de mise à jour intégré ne s’exécute plus du tout, car le Snap Store s’en charge. D’autres causes rares de plantage (ouverture de liens externes, notifications sous confinement Snap strict) sont elles aussi interceptées.',
        it: 'Sulla versione Snap poteva comparire all’improvviso una finestra "A JavaScript error occurred in the main process". Derivava dal controllo aggiornamenti in background che scriveva su un canale di log chiuso. Ora questo non manda più in crash l’app e su Snap l’updater integrato non viene più eseguito, perché ci pensa lo Snap Store. Vengono ora intercettate anche altre rare cause di crash (apertura di link esterni, notifiche sotto confinamento Snap stretto).'
      }
    },
    {
      icon: 'refresh',
      title: {
        de: 'Darstellung beim geteilten Bildschirm',
        en: 'Split-screen display fix',
        fr: 'Affichage en écran partagé',
        it: 'Visualizzazione a schermo diviso'
      },
      text: {
        de: 'Beim Anordnen des Fensters auf eine Bildschirmhälfte (Tiling) blieb die Seite manchmal auf der alten Größe stehen: Inhalt nach oben verschoben, unten ein grauer Streifen. Nach dem Ändern der Fenstergröße passt die App die Seite jetzt zuverlässig an die endgültige Größe an.',
        en: 'When you tiled the window to half the screen, the page could stay stuck at the old size: content shifted up, a gray strip left at the bottom. After a resize settles, the app now reliably re-fits the page to the final window size.',
        fr: 'En plaçant la fenêtre sur une moitié d’écran (tiling), la page pouvait rester à l’ancienne taille : contenu décalé vers le haut, bande grise en bas. Une fois le redimensionnement terminé, l’application réajuste désormais la page à la taille finale de la fenêtre.',
        it: 'Affiancando la finestra a metà schermo (tiling), la pagina poteva restare alla vecchia dimensione: contenuto spostato in alto, una striscia grigia in basso. Al termine del ridimensionamento, l’app ora riadatta in modo affidabile la pagina alla dimensione finale della finestra.'
      }
    },
    {
      icon: 'cog',
      title: {
        de: 'Anmeldung bei Connectors',
        en: 'Connector sign-in',
        fr: 'Connexion aux connecteurs',
        it: 'Accesso ai connettori'
      },
      text: {
        de: 'Anmelde-Popups, die ein weiteres Fenster öffnen (etwa bei Microsoft), bleiben jetzt in der App und in deiner Sitzung, statt ein unkontrolliertes Fenster zu öffnen. Externe Links während der Anmeldung werden strenger behandelt: eingebettete Bereiche dürfen nicht mehr beliebigen Anmelde-Adressen folgen, und eine Anmeldung auf einer Anbieterseite bleibt auf deren eigene Domain begrenzt.',
        en: 'Sign-in popups that open another window (for example with Microsoft) now stay inside the app and on your session instead of spawning an uncontrolled window. External links during sign-in are handled more strictly: embedded areas can no longer follow arbitrary sign-in URLs, and a sign-in on a provider page stays limited to that provider’s own domain.',
        fr: 'Les fenêtres de connexion qui en ouvrent une autre (par exemple avec Microsoft) restent désormais dans l’application et sur votre session au lieu d’ouvrir une fenêtre non contrôlée. Les liens externes pendant la connexion sont traités plus strictement : les zones intégrées ne peuvent plus suivre n’importe quelle adresse de connexion, et une connexion sur la page d’un fournisseur reste limitée à son propre domaine.',
        it: 'I popup di accesso che ne aprono un altro (ad esempio con Microsoft) ora restano nell’app e nella tua sessione invece di aprire una finestra non controllata. I link esterni durante l’accesso sono gestiti in modo più rigoroso: le aree incorporate non possono più seguire indirizzi di accesso arbitrari e un accesso sulla pagina di un provider resta limitato al suo dominio.'
      }
    },
    {
      icon: 'download',
      title: {
        de: 'Update-Suche im Snap',
        en: 'Update check on Snap',
        fr: 'Recherche de mises à jour (Snap)',
        it: 'Controllo aggiornamenti su Snap'
      },
      text: {
        de: '„Nach Updates suchen" gab in der Snap-Version keine Rückmeldung mehr. Jetzt erscheint der Hinweis, dass Updates über den Snap Store kommen und automatisch installiert werden.',
        en: '"Check for Updates" gave no feedback on the Snap build. It now tells you that updates come from the Snap Store and are installed automatically.',
        fr: '« Rechercher des mises à jour » ne donnait aucun retour sur la version Snap. Un message indique désormais que les mises à jour proviennent du Snap Store et sont installées automatiquement.',
        it: '"Controlla aggiornamenti" non dava alcun riscontro sulla versione Snap. Ora un messaggio indica che gli aggiornamenti arrivano dallo Snap Store e vengono installati automaticamente.'
      }
    }
  ],
  '1.4.5': [
    {
      icon: 'bolt',
      title: {
        de: 'Tastaturfokus nach Alt+Tab',
        en: 'Keyboard focus after Alt+Tab',
        fr: 'Focus clavier après Alt+Tab',
        it: 'Focus da tastiera dopo Alt+Tab'
      },
      text: {
        de: 'Beim Zurückwechseln per Alt+Tab landete der Tastaturfokus auf dem Minimieren-Knopf statt im Chat. Der erste Tastendruck minimierte dann das Fenster, statt zu schreiben. Der Fokus geht jetzt direkt in die Seite zurück.',
        en: 'When you switched back with Alt+Tab, the keyboard focus landed on the minimize button instead of the chat. The first keystroke then minimized the window instead of typing. Focus now goes straight back to the page.',
        fr: 'En revenant avec Alt+Tab, le focus clavier se plaçait sur le bouton Réduire au lieu du chat. La première touche réduisait alors la fenêtre au lieu d’écrire. Le focus revient désormais directement sur la page.',
        it: 'Tornando con Alt+Tab, il focus da tastiera finiva sul pulsante Riduci a icona invece che nella chat. Il primo tasto premuto riduceva la finestra invece di scrivere. Ora il focus torna direttamente alla pagina.'
      }
    }
  ],
  '1.4.4': [
    {
      icon: 'shield',
      title: {
        de: 'Sicherheitsprüfung bleibt seltener hängen',
        en: 'Fewer security-check loops',
        fr: 'Moins de blocages à la vérification de sécurité',
        it: 'Meno blocchi alla verifica di sicurezza'
      },
      text: {
        de: 'Die App meldete sich bei der Cloudflare-Sicherheitsprüfung mit einer Kennung, die ein echter Linux-Browser so nie sendet (der Kernel-Version). Das konnte die Prüfung in eine Schleife laufen lassen. Die Kennung entspricht jetzt exakt der eines normalen Chrome unter Linux. Falls die Prüfung doch hängt, hilft weiterhin „claude.ai-Verifizierung zurücksetzen" im Menü.',
        en: 'The app identified itself to the Cloudflare security check with a value no real Linux browser sends (the kernel version), which could send the check into a loop. That value now matches a normal Chrome on Linux exactly. If the check still hangs, "Reset claude.ai verification" in the menu still helps.',
        fr: 'L’application se présentait à la vérification de sécurité Cloudflare avec une valeur qu’aucun vrai navigateur Linux n’envoie (la version du noyau), ce qui pouvait faire boucler la vérification. Cette valeur correspond désormais exactement à celle d’un Chrome normal sous Linux. Si la vérification se bloque encore, « Réinitialiser la vérification claude.ai » dans le menu reste utile.',
        it: 'L’app si presentava alla verifica di sicurezza di Cloudflare con un valore che nessun browser Linux reale invia (la versione del kernel), e questo poteva mandare la verifica in loop. Ora quel valore corrisponde esattamente a quello di un normale Chrome su Linux. Se la verifica si blocca ancora, "Reimposta la verifica claude.ai" nel menu è ancora d’aiuto.'
      }
    }
  ],
  '1.4.3': [
    {
      icon: 'palette',
      title: {
        de: 'Neues Logo und aufgefrischtes Design',
        en: 'New logo and a refreshed look',
        fr: 'Nouveau logo et un design rafraîchi',
        it: 'Nuovo logo e un design rinfrescato'
      },
      text: {
        de: 'Die App hat ein neues Spark-Logo, und die drei Themes sind von Grund auf neu aufgebaut. Die Farbverläufe im Hintergrund kamen bei vielen nicht gut an, deshalb sind sie überall raus: in den Menüs, den Einstellungs- und Info-Fenstern und im Chat. Jedes Theme ist jetzt klar für sich gebaut: Hell ist ein neutrales Weiß ohne den früheren rötlichen Stich, Dunkel bleibt ruhig und gleichmäßig, und OLED zeigt durchgehend tiefes Schwarz mit ein paar dezenten Sternen im Hintergrund.',
        en: 'The app has a new spark logo, and the three themes are rebuilt from the ground up. The background gradients did not sit well with many people, so they are gone everywhere: in the menus, the settings and info windows, and the chat. Each theme is now built on its own terms: light is a neutral white without the earlier reddish tint, dark stays calm and even, and OLED is consistently deep black with a few subtle stars in the background.',
        fr: 'L’application a un nouveau logo « spark », et les trois thèmes sont reconstruits de zéro. Les dégradés en arrière-plan ne plaisaient pas à beaucoup de monde, ils ont donc disparu partout : dans les menus, les fenêtres de réglages et d’informations, et le chat. Chaque thème est désormais conçu pour lui-même : le clair est un blanc neutre sans la teinte rougeâtre d’avant, le sombre reste calme et homogène, et l’OLED affiche un noir profond et uniforme avec quelques étoiles discrètes en arrière-plan.',
        it: 'L’app ha un nuovo logo spark e i tre temi sono ricostruiti da zero. Le sfumature sullo sfondo non piacevano a molti, quindi sono state rimosse ovunque: nei menu, nelle finestre di impostazioni e informazioni e nella chat. Ogni tema ora è costruito per conto suo: il chiaro è un bianco neutro senza la tinta rossastra di prima, lo scuro resta calmo e uniforme e l’OLED mostra un nero profondo e uniforme con qualche stella discreta sullo sfondo.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: 'Theme ohne Nachladen',
        en: 'Theme without lag',
        fr: 'Thème sans délai',
        it: 'Tema senza ritardi'
      },
      text: {
        de: 'Das Theme steht jetzt sofort beim App-Start und beim Öffnen eines neuen Tabs. Vorher baute es sich mit kurzer Verzögerung sichtbar auf.',
        en: 'The theme is in place immediately when the app starts and when you open a new tab. Before, it built up visibly with a short delay.',
        fr: 'Le thème est en place immédiatement au démarrage de l’application et à l’ouverture d’un nouvel onglet. Auparavant, il se mettait en place avec un léger délai visible.',
        it: 'Il tema è presente subito all’avvio dell’app e quando apri una nuova scheda. Prima si formava con un breve ritardo visibile.'
      }
    },
    {
      icon: 'plus',
      title: {
        de: 'Eigene Connectors verbinden sich wieder',
        en: 'Custom connectors connect again',
        fr: 'Les connecteurs personnalisés se connectent à nouveau',
        it: 'I connettori personalizzati si collegano di nuovo'
      },
      text: {
        de: 'Beim Hinzufügen eines eigenen Connectors öffnete sich das Anmelde-Popup im Systembrowser, wo die Verbindung nie zurückkam. Es öffnet jetzt in der App, sodass die Verbindung abgeschlossen wird.',
        en: 'When you added a custom connector, the sign-in popup opened in the system browser, where the connection never came back. It now opens inside the app so the connection completes.',
        fr: 'Lors de l’ajout d’un connecteur personnalisé, la fenêtre de connexion s’ouvrait dans le navigateur système, où la connexion n’aboutissait jamais. Elle s’ouvre désormais dans l’application, ce qui permet de terminer la connexion.',
        it: 'Quando aggiungevi un connettore personalizzato, il popup di accesso si apriva nel browser di sistema, dove la connessione non tornava mai. Ora si apre nell’app, così la connessione viene completata.'
      }
    },
    {
      icon: 'download',
      title: {
        de: 'Snap: Dateien anhängen und speichern',
        en: 'Snap: attaching and saving files',
        fr: 'Snap : joindre et enregistrer des fichiers',
        it: 'Snap: allegare e salvare file'
      },
      text: {
        de: 'Unter Snap laufen das Anhängen von Dateien und das Speichern von Downloads jetzt über das System-Dateiportal. Damit erreichst du auch Dateien außerhalb deines persönlichen Ordners und auf externen Datenträgern.',
        en: 'On Snap, attaching files and saving downloads now go through the system file portal, so you can reach files outside your home folder and on external drives.',
        fr: 'Sous Snap, joindre des fichiers et enregistrer des téléchargements passe désormais par le portail de fichiers du système, ce qui permet d’accéder aux fichiers hors de votre dossier personnel et sur des disques externes.',
        it: 'Su Snap, allegare file e salvare i download avviene ora tramite il portale file di sistema, così puoi raggiungere i file fuori dalla tua cartella personale e su unità esterne.'
      },
      if: 'snap'
    },
    {
      icon: 'shield',
      title: {
        de: 'Aktualisierter Unterbau',
        en: 'Updated foundation',
        fr: 'Socle mis à jour',
        it: 'Base aggiornata'
      },
      text: {
        de: 'Aktualisiert auf das neueste Electron 41 mit den aktuellen Chromium-Sicherheitsfixes.',
        en: 'Updated to the latest Electron 41 with the current Chromium security fixes.',
        fr: 'Mise à jour vers la dernière version d’Electron 41 avec les correctifs de sécurité Chromium actuels.',
        it: 'Aggiornato all’ultima versione di Electron 41 con le correzioni di sicurezza di Chromium attuali.'
      }
    }
  ],
  '1.4.2': [
    {
      icon: 'bolt',
      title: {
        de: 'Italienisch und Französisch',
        en: 'Italian and French',
        fr: 'Italien et français',
        it: 'Italiano e francese'
      },
      text: {
        de: 'Die App-Oberfläche gibt es jetzt auch auf Italienisch und Französisch. Sie richtet sich nach deiner Systemsprache; ist deine Sprache nicht dabei, bleibt es bei Englisch.',
        en: 'The app interface is now also available in Italian and French. It follows your system language; if your language is not available, it stays in English.',
        fr: 'L’interface de l’application est désormais disponible en italien et en français. Elle suit la langue de votre système ; si votre langue n’est pas disponible, elle reste en anglais.',
        it: 'L’interfaccia dell’app è ora disponibile anche in italiano e francese. Segue la lingua del sistema; se la tua lingua non è disponibile, resta in inglese.'
      }
    },
    {
      icon: 'settings',
      title: {
        de: 'OLED-Tableiste jetzt einheitlich',
        en: 'OLED tab bar now consistent',
        fr: 'Barre d’onglets OLED uniforme',
        it: 'Barra delle schede OLED uniforme'
      },
      text: {
        de: 'Die Tab-Leiste nutzte beim Live-Umschalten auf OLED einen leicht anderen Schwarzton als beim Start direkt im OLED-Modus. Beide verwenden jetzt denselben Wert.',
        en: 'The tab bar used a slightly different black when you switched to OLED live versus starting up in OLED. Both now use the same value.',
        fr: 'La barre d’onglets utilisait un noir légèrement différent selon que vous passiez en OLED en cours d’usage ou au démarrage. Les deux utilisent désormais la même valeur.',
        it: 'La barra delle schede usava un nero leggermente diverso a seconda che passassi a OLED durante l’uso o all’avvio. Ora entrambe usano lo stesso valore.'
      }
    },
    {
      icon: 'tray',
      title: {
        de: 'Snap: Benachrichtigungen und kleinerer Download',
        en: 'Snap: notifications and a smaller download',
        fr: 'Snap : notifications et téléchargement plus léger',
        it: 'Snap: notifiche e download più leggero'
      },
      text: {
        de: 'Die App meldet sich gegenüber GNOME jetzt korrekt als Absender, damit Antwort- und Download-Benachrichtigungen unter Snap nicht mehr ausgefiltert werden. Außerdem ist der Download etwas kleiner.',
        en: 'The app now identifies itself to GNOME as the sender so reply and download notifications are no longer filtered out on Snap. The download is also a little smaller.',
        fr: 'L’application s’identifie désormais correctement auprès de GNOME, afin que les notifications de réponse et de téléchargement ne soient plus filtrées sous Snap. Le téléchargement est aussi un peu plus léger.',
        it: 'L’app ora si identifica correttamente con GNOME, così le notifiche di risposta e download non vengono più filtrate su Snap. Il download è anche un po’ più leggero.'
      },
      if: 'snap'
    }
  ],
  '1.4.1': [
    {
      icon: 'check',
      title: {
        de: '"Was ist neu" jetzt auch auf Englisch',
        en: '"What’s new" now also localized'
      },
      text: {
        de: 'Auf englischsprachigen Systemen erschienen die Update-Hinweise bislang weiterhin auf Deutsch, weil die Notes-Texte hartkodiert deutsch waren. Sie respektieren jetzt die System-Sprache. Als Nachreichung siehst du unten die Highlights aus 1.4.0 in deiner Sprache.',
        en: 'On non-German systems the update window kept showing German text because the note strings were hard-coded. Notes now follow the system language, and as a one-time catch-up you can read the 1.4.0 highlights below in your language.'
      }
    }
  ],
  '1.3.0': [
    {
      icon: 'tray',
      title: { de: 'Systemtray & Hintergrund-Modus', en: 'System tray & background mode' },
      text: { de: 'Claude l\u00e4uft jetzt im Hintergrund weiter und ist \u00fcber das Tray-Symbol erreichbar.', en: 'Claude now keeps running in the background and is reachable via the tray icon.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Globaler Quick-Prompt', en: 'Global Quick-Prompt' },
      text: { de: 'Ein frei w\u00e4hlbarer Hotkey \u00f6ffnet ein Eingabefenster f\u00fcr neue Chats \u2013 direkt aus jeder App.', en: 'A configurable hotkey opens an input window for new chats, from any app.' }
    },
    {
      icon: 'check',
      title: { de: 'Update-Check mit Feedback', en: 'Update check with feedback' },
      text: { de: 'Das Men\u00fc zeigt jetzt klar an, ob ein Update bereitsteht oder die App aktuell ist.', en: 'The menu now clearly shows whether an update is available or the app is up to date.' }
    },
    {
      icon: 'settings',
      title: { de: 'App-Einstellungen', en: 'App settings' },
      text: { de: 'Neuer Dialog f\u00fcr Tray-Verhalten und Hotkey \u2013 jederzeit \u00fcber das Men\u00fc erreichbar.', en: 'New dialog for tray behavior and hotkey, reachable from the menu any time.' }
    }
  ],
  '1.3.1': [
    {
      icon: 'check',
      title: { de: 'Download-Dialog nicht mehr doppelt', en: 'Download dialog no longer duplicated' },
      text: { de: 'Beim Speichern von Dateien aus Chats erscheint der Dialog jetzt zuverl\u00e4ssig nur einmal \u2013 auch bei Blob- und Redirect-Downloads.', en: 'When saving files from chats, the dialog now reliably appears only once, including for blob and redirect downloads.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Quick-Prompt sendet nicht mehr automatisch', en: 'Quick-Prompt no longer sends automatically' },
      text: { de: 'Der Text wird ins Eingabefeld \u00fcbernommen und der Cursor ans Ende gesetzt. Du dr\u00fcckst selbst Enter zum Absenden.', en: 'The text is placed in the input box with the cursor at the end. You press Enter yourself to send.' }
    },
    {
      icon: 'settings',
      title: { de: 'Dialoge zentriert \u00fcber der App', en: 'Dialogs centered over the app' },
      text: { de: 'Update- und Hinweis-Dialoge \u00f6ffnen sich jetzt zuverl\u00e4ssig zentriert \u00fcber dem App-Fenster \u2013 auch auf Multi-Monitor-Setups.', en: 'Update and notice dialogs now reliably open centered over the app window, including on multi-monitor setups.' }
    },
    {
      icon: 'check',
      title: { de: 'Code-Tab in der Sidebar funktioniert', en: 'Code tab in the sidebar works' },
      text: { de: 'Der Klick auf \u201eCode" in der Sidebar \u00f6ffnet die Seite jetzt korrekt in einem neuen Fenster, statt sich sofort wieder zu schlie\u00dfen.', en: 'Clicking "Code" in the sidebar now correctly opens the page in a new window instead of closing immediately.' }
    },
    {
      icon: 'tray',
      title: { de: 'Tray-Icon besser erkennbar', en: 'Tray icon more visible' },
      text: { de: 'Das Symbol in der Systemleiste zeigt jetzt das Sparkle-Logo gr\u00f6\u00dfer und transparent \u2013 deutlich sichtbar auf hellen wie dunklen Tray-Hintergr\u00fcnden.', en: 'The system tray icon now shows the sparkle logo larger and transparent, clearly visible on light and dark tray backgrounds.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Autostart beim Anmelden', en: 'Autostart at login' },
      text: { de: 'Optional kann Claude jetzt automatisch beim Hochfahren des Systems starten \u2013 ein- und ausschaltbar in den App-Einstellungen.', en: 'Optionally Claude can now launch automatically when the system starts, toggled in the app settings.' }
    }
  ],
  '1.3.3': [
    {
      icon: 'check',
      title: { de: 'Artifact-Vorschauen werden wieder angezeigt', en: 'Artifact previews render again' },
      text: { de: 'HTML-, React- und Wireframe-Vorschauen aus Chats erscheinen jetzt wieder im Vorschau-Panel \u2013 vorher blieb es leer, weil die App den separaten Anzeige-Server (claudeusercontent.com) blockiert hat.', en: 'HTML, React and wireframe previews from chats now show up in the preview panel again. Previously the panel stayed empty because the app blocked the separate display origin (claudeusercontent.com).' }
    }
  ],
  '1.3.4': [
    {
      icon: 'bolt',
      title: { de: 'Direkt aus der App Fehler melden', en: 'Report bugs straight from the app' },
      text: { de: 'Statt eine E-Mail zu schreiben kannst du jetzt einen kurzen Bericht direkt im Fenster ausf\u00fcllen \u2013 mit optionalen Fehlercodes und Kontakt-Mail. App-Version, OS und Sprache werden auf Wunsch automatisch mitgesendet.', en: 'Instead of writing an email you can now fill in a short report directly in the window, with optional error codes and contact mail. App version, OS and language are sent along on request.' }
    },
    {
      icon: 'settings',
      title: { de: 'Dialoge erscheinen \u00fcber der App', en: 'Dialogs appear over the app' },
      text: { de: 'App-Einstellungen, Bug-Report und Update-Hinweise zentrieren sich jetzt auf dem Hauptfenster \u2013 egal wo du die App auf dem Bildschirm hast.', en: 'App settings, Bug Report and update notices now center on the main window, no matter where the app sits on screen.' }
    },
    {
      icon: 'check',
      title: { de: 'Autostart funktioniert jetzt automatisch', en: 'Autostart now works out of the box' },
      text: { de: 'Der Autostart-Schalter in den App-Einstellungen funktioniert ab sofort ohne manuellen Setup-Schritt \u2013 einfach umlegen, fertig.', en: 'The autostart toggle in app settings now works without a manual setup step \u2013 just flip it and you\u2019re done.' },
      if: 'snap'
    }
  ],
  '1.3.5': [
    {
      icon: 'settings',
      title: { de: 'Neue Tab-Leiste mit App-Men\u00fc', en: 'New tab bar with app menu' },
      text: { de: 'Das Men\u00fc-Icon ganz links (\u2261) \u00f6ffnet ein eigenes App-Men\u00fc mit allen wichtigen Funktionen. Zus\u00e4tzlich hat die Tab-Leiste jetzt direkten Zugriff auf Konversations-Export und Bug-Report.', en: 'The menu icon on the far left (\u2261) opens a dedicated app menu with all the important actions. The tab bar also gives you direct access to conversation export and Bug Report.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Konversation als Markdown exportieren', en: 'Export conversation as Markdown' },
      text: { de: 'Mit Strg+Shift+E (oder \u00fcber das Men\u00fc) speicherst du den aktuellen Chat als .md-Datei \u2013 inklusive Code-Bl\u00f6cken, Listen und \u00dcberschriften.', en: 'Ctrl+Shift+E (or via the menu) saves the current chat as an .md file, including code blocks, lists and headings.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Prompt-Templates f\u00fcr den Quick-Prompt', en: 'Prompt templates for the Quick-Prompt' },
      text: { de: 'In den App-Einstellungen legst du eigene Prefix-Texte an (z.B. \u201e\u00dcbersetze ins Englische:"). Im Quick-Prompt-Fenster w\u00e4hlst du sie per Tab aus und tippst nur noch deinen Inhalt.', en: 'In app settings you can define your own prefix texts (e.g. "Translate to English:"). In the Quick-Prompt window you pick one with Tab and only type your content.' }
    },
    {
      icon: 'tray',
      title: { de: 'Benachrichtigung f\u00fcr Hintergrund-Tabs', en: 'Notification for background tabs' },
      text: { de: 'Optional schickt Claude eine native Notification, sobald die Antwort in einem nicht aktiven Tab fertig ist. Aktivierbar in den App-Einstellungen.', en: 'Optionally Claude sends a native notification as soon as a response finishes in an inactive tab. Enabled in app settings.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Zwischenablage als neuer Chat', en: 'Clipboard as a new chat' },
      text: { de: 'Ein eigener globaler Hotkey \u00f6ffnet einen frischen Chat und f\u00fcgt automatisch den Text aus der Zwischenablage als Prompt ein.', en: 'A dedicated global hotkey opens a fresh chat and pastes the clipboard text as the prompt.' }
    },
    {
      icon: 'check',
      title: { de: 'Copy & Paste im Snap funktioniert wieder', en: 'Copy & paste works again in the Snap' },
      text: { de: 'Auf Wayland-Sessions konnte die Snap-Version Inhalte nicht zuverl\u00e4ssig zwischen Apps kopieren. Mit dem neuen Launch-Pfad (native Wayland-Clipboard) klappt Kopieren und Einf\u00fcgen jetzt sauber.', en: 'On Wayland sessions the Snap build could not reliably copy between apps. With the new launch path (native Wayland clipboard) copy and paste now work cleanly.' },
      if: 'snap'
    },
    {
      icon: 'heart',
      title: { de: 'Danke f\u00fcrs Nutzen!', en: 'Thanks for using the app!' },
      text: { de: 'St\u00f6\u00dft du auf einen Fehler? Bitte \u00fcber das K\u00e4fer-Symbol oben in der Tab-Leiste melden \u2013 jeder Bericht hilft mir, die App zu verbessern. Vielen Dank f\u00fcr deinen Support.', en: 'Hit a bug? Please report it via the bug icon at the top of the tab bar \u2013 every report helps me improve the app. Thanks for your support.' }
    }
  ],
  '1.3.6': [
    {
      icon: 'bolt',
      title: { de: 'Spracheingabe per Mikrofon', en: 'Voice input via microphone' },
      text: { de: 'Beim ersten Klick auf das Mikrofon-Symbol in claude.ai fragt die App einmal um Erlaubnis. Du kannst die Berechtigung jederzeit in den App-Einstellungen unter \u201eMikrofon" wieder ausschalten.', en: 'The first time you click the microphone icon in claude.ai, the app asks once for permission. You can disable it again any time in app settings under "Microphone".' }
    },
    {
      icon: 'settings',
      title: { de: 'Snap: Mikrofon mit einem Klick freigeben', en: 'Snap: enable the microphone in one click' },
      text: { de: 'Im Hinweis-Dialog zeigt dir die App den Snap-Berechtigungs-Status live. \u201eIm Snap-Store \u00f6ffnen" springt direkt in den Store \u2013 oder du kopierst den Terminal-Befehl mit einem Klick. Der Dialog erkennt die Aktivierung automatisch, egal welchen Weg du nimmst.', en: 'The consent dialog shows the live Snap permission status. "Open in Snap Store" jumps straight to the store, or you copy the terminal command with one click. The dialog detects the activation automatically either way.' },
      if: 'snap'
    },
    {
      icon: 'bolt',
      title: { de: 'Live-Hinweise direkt in der App', en: 'Live notices directly in the app' },
      text: { de: 'Wichtige Hinweise (z.B. zu bekannten Problemen oder Updates) erscheinen jetzt als Banner \u00fcber der Tab-Leiste. Sie kommen direkt vom Projekt-Repo und k\u00f6nnen jederzeit per Klick auf das \u00d7 weggeschoben werden.', en: 'Important notices (e.g. known issues or updates) now appear as banners above the tab bar. They come straight from the project repo and can be dismissed any time by clicking \u00d7.' }
    }
  ],
  '1.3.7': [
    {
      icon: 'check',
      title: { de: 'App startet nach Auto-Update wieder zuverl\u00e4ssig', en: 'App launches reliably again after auto-update' },
      text: { de: 'Nach einem automatischen Update startete die App beim n\u00e4chsten Aufruf \u00fcber den Men\u00fc-Eintrag manchmal nicht mehr, weil die Verkn\u00fcpfung noch auf die alte Datei zeigte. Das ist behoben \u2013 die Verkn\u00fcpfungen werden jetzt bei jedem Start gepr\u00fcft und bei Bedarf automatisch auf die aktuelle Version umgebogen.', en: 'After an automatic update, launching via the menu entry sometimes failed because the shortcut still pointed to the old file. Fixed \u2013 shortcuts are now checked on every start and silently retargeted to the current version when needed.' }
    },
    {
      icon: 'check',
      title: { de: 'Stabiler Start aus dem App-Men\u00fc', en: 'Stable launch from the system menu' },
      text: { de: 'Beim Start aus dem System-App-Men\u00fc oder per Doppelklick aus dem Dateimanager kam es nach Updates teils zu Sandbox-Fehlern. Die App setzt das n\u00f6tige Flag jetzt selbst, der Start ist wieder stabil.', en: 'Launching from the system app menu or by double-click from the file manager occasionally hit sandbox errors after updates. The app now sets the required flag itself, so launch is stable again.' }
    }
  ],
  '1.3.8': [
    {
      icon: 'check',
      title: { de: 'Snap: Mikrofon-Status live im Settings sichtbar', en: 'Snap: microphone status visible live in settings' },
      text: { de: 'In den App-Einstellungen unter \u201eMikrofon" zeigt eine kleine farbige Anzeige jetzt direkt, ob die Audio-Record-Berechtigung im Snap aktiv ist. Wenn du den Schalter aktivierst und die Berechtigung noch fehlt, ploppt der Hilfedialog automatisch auf.', en: 'In app settings under "Microphone" a small colored indicator now shows directly whether the Snap audio-record permission is active. If you toggle the switch and the permission is still missing, the help dialog opens automatically.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Hinweis-Dialog merkt, wenn du die Snap-Berechtigung aktivierst', en: 'Consent dialog notices when you enable the Snap permission' },
      text: { de: 'Sobald du im Snap-Store \u201eAudio Record" einschaltest oder den Befehl im Terminal ausf\u00fchrst, blinkt der Erlauben-Knopf im Mikrofon-Hinweis kurz auf \u2013 du musst nicht raten, ob alles geklappt hat.', en: 'The moment you enable "Audio Record" in the Snap Store or run the terminal command, the Allow button in the microphone notice briefly flashes \u2013 no guessing whether it took effect.' }
    },
    {
      icon: 'settings',
      title: { de: 'Robustere Antwort-Erkennung', en: 'More robust response detection' },
      text: { de: 'Die Hintergrund-Benachrichtigung \u201eClaude ist fertig" pr\u00fcft jetzt mehrere Strategien parallel. Wenn claude.ai sein Layout \u00e4ndert, greift einer der Fallbacks und die Notifications bleiben am Laufen.', en: 'The background "Claude is done" notification now checks several strategies in parallel. When claude.ai changes its layout, one of the fallbacks takes over and notifications keep working.' }
    },
    {
      icon: 'bug',
      title: { de: 'Klarer Hinweis im Bug-Report', en: 'Clear notice in the Bug Report' },
      text: { de: 'Im Fehler-melden-Fenster steht jetzt ein deutlicher Hinweis: das hier ist ein inoffizieller Community-Wrapper, kein offizieller Anthropic-Support. Bei Account-, Login-, Abo- oder Bezahl-Fragen f\u00fchrt ein Link direkt zu support.anthropic.com.', en: 'The Bug Report window now carries a clear notice: this is an unofficial community wrapper, not official Anthropic support. A link points to support.anthropic.com for account, login, subscription or billing questions.' }
    }
  ],
  '1.3.9': [
    {
      icon: 'check',
      title: { de: 'Wayland: Fenster landen wieder dort, wo sie hingeh\u00f6ren', en: 'Wayland: windows land where they should again' },
      text: { de: 'Auf Wayland-Sitzungen (GNOME, KDE Plasma) sind App-Men\u00fc, Einstellungen, Bug-Report und das Quick-Prompt-Fenster zuvor an zuf\u00e4lligen Stellen \u00fcber den Bildschirm verteilt aufgeploppt \u2013 weil Wayland clientseitige Fenster-Positionierung nicht erlaubt. Die App startet auf Wayland jetzt automatisch \u00fcber XWayland (so wie es VS Code, Discord und Signal auch machen). Dialoge sitzen wieder zentriert, das App-Men\u00fc \u00f6ffnet direkt unter dem Hamburger-Button.', en: 'On Wayland sessions (GNOME, KDE Plasma) the app menu, settings, Bug Report and the Quick-Prompt window used to pop up at random positions across the screen because Wayland does not allow client-side window positioning. On Wayland the app now starts via XWayland automatically (like VS Code, Discord and Signal do). Dialogs are centered again, and the app menu opens directly under the hamburger button.' }
    },
    {
      icon: 'bug',
      title: { de: 'Bug-Report-Fenster nicht mehr mehrfach aufrufbar', en: 'Bug Report window can no longer open multiple times' },
      text: { de: 'Mehrfach-Klick auf das K\u00e4fer-Symbol hat zuvor mehrere identische Bug-Report-Fenster nebeneinander ge\u00f6ffnet. Jetzt fokussiert die App das bestehende Fenster, statt ein neues zu spawnen.', en: 'Multi-clicking the bug icon used to open multiple identical Bug Report windows side by side. The app now focuses the existing window instead of spawning a new one.' }
    },
    {
      icon: 'settings',
      title: { de: 'Hamburger-Men\u00fc \u00f6ffnet sich nur noch einmal', en: 'Hamburger menu only opens once' },
      text: { de: 'Schnelles Mehrfach-Klicken auf das Men\u00fc-Icon konnte zuvor mehrere Men\u00fc-Fenster gleichzeitig erzeugen. Der Cooldown greift jetzt sofort beim Klick, nicht erst nach dem Schlie\u00dfen.', en: 'Rapidly multi-clicking the menu icon could previously create several menu windows at once. The cooldown now kicks in on click, not only after closing.' }
    },
    {
      icon: 'bolt',
      title: { de: 'Hinweis bei nicht registrierbarem Hotkey', en: 'Note when a hotkey cannot be registered' },
      text: { de: 'Falls die Registrierung eines globalen Hotkeys auf Wayland am Compositor scheitert (GNOME erlaubt es z.B. eingeschr\u00e4nkt), zeigt das App-Einstellungen-Fenster jetzt einen klaren Hinweistext, statt eine generische Fehlermeldung.', en: 'If registering a global hotkey on Wayland fails at the compositor (GNOME, for example, only allows it in a limited way), the app settings window now shows a clear hint text instead of a generic error.' }
    }
  ],
  '1.4.0': [
    {
      icon: 'settings',
      title: {
        de: 'Rahmenloses Fenster mit eigener Leiste',
        en: 'Frameless window with a custom bar'
      },
      text: {
        de: 'Das Hauptfenster läuft jetzt ohne System-Titelleiste. Tab-Bar und Window-Controls (Minimieren, Maximieren, Schließen) liegen direkt nebeneinander, ziehen funktioniert weiterhin überall auf den freien Bereichen der Leiste. Doppelklick auf die Leiste maximiert bzw. stellt wieder her.',
        en: 'The main window now runs without the system title bar. The tab bar and window controls (Minimize, Maximize, Close) sit next to each other; dragging still works on any free area of the bar. Double-clicking the bar toggles maximize.'
      }
    },
    {
      icon: 'settings',
      title: {
        de: 'OLED-Theme als drittes Design',
        en: 'OLED theme as a third mode'
      },
      text: {
        de: 'Das Sonne/Mond-Icon in der Leiste schaltet jetzt zwischen drei Modi um: Hell, Dunkel und OLED. Im OLED-Modus wird claude.ai auf einen warmen schwarzen Untergrund mit Brand-Glow umgefärbt – ideal für OLED-Bildschirme. Mit diesem Update ist OLED einmalig vorausgewählt; wer lieber Hell oder das klassische Dunkel möchte, klickt einfach das Sonne/Mond-Icon weiter, der Wechsel wird wie gewohnt gespeichert.',
        en: 'The sun/moon icon in the bar now cycles through three modes: Light, Dark and OLED. In OLED mode claude.ai is rendered on a warm near-black background with a subtle brand glow, ideal for OLED screens. OLED is preselected on the first launch after the update; click the sun/moon icon to switch back to Light or the classic Dark, and your choice is remembered as usual.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: 'Animierter Gradient um den Chat-Block',
        en: 'Animated gradient around the chat box'
      },
      text: {
        de: 'Das Eingabefeld auf der claude.ai-Startseite bekommt jetzt einen feinen, animierten Verlauf in der Markenfarbe – Orange wandert zu Magenta und zurück, im gleichen Stil wie das Quick-Prompt-Fenster.',
        en: 'The composer on the claude.ai home screen now gets a thin animated brand-color gradient, orange shifting to magenta and back, matching the Quick-Prompt window style.'
      }
    },
    {
      icon: 'settings',
      title: {
        de: 'Alle Dialoge im neuen rahmenlosen Stil',
        en: 'All dialogs in the new frameless style'
      },
      text: {
        de: '"Was ist neu", "Über Claude Desktop", Einstellungen und Fehler-Report nutzen jetzt dieselbe kompakte Titelleiste wie das Hauptfenster, mit eigenem X-Knopf rechts und im OLED-Modus mit dezentem Brand-Glow im Hintergrund.',
        en: '"What’s new", "About Claude Desktop", Settings and Bug Report now use the same compact title bar as the main window, with their own close button on the right and a subtle brand glow in the background while in OLED mode.'
      }
    },
    {
      icon: 'bolt',
      title: {
        de: '"Was ist neu" neu gestaltet',
        en: '"What’s new" redesigned'
      },
      text: {
        de: 'Das Update-Fenster, das du gerade vor dir hast, ist neu: animierter Brand-Hero oben, Highlights als Kacheln im Raster mit Icon-Kachel pro Punkt. Übersichtlicher und passt zum restlichen Design.',
        en: 'The update window you are looking at is new: an animated brand hero at the top, highlights laid out as a grid of tiles with an icon per entry. Cleaner and consistent with the rest of the design.'
      }
    },
    {
      icon: 'check',
      title: {
        de: 'Logo passt sich dem Theme an',
        en: 'Logo adapts to the theme'
      },
      text: {
        de: 'Das App-Logo im "Über"-Fenster, im Hamburger-Menü und im Quick-Prompt erscheint im OLED-Modus auf einer dunklen Kachel mit zarter Brand-Aura, damit das Symbol nicht im Schwarz verschwindet.',
        en: 'In OLED mode the app logo in the About window, hamburger menu and Quick-Prompt sits on a dark tile with a soft brand aura, so the icon stays visible against the near-black background.'
      }
    },
    {
      icon: 'check',
      title: {
        de: 'Stabilität und kleinere Fixes',
        en: 'Stability and small fixes'
      },
      text: {
        de: 'Window-Controls-IPC prüft jetzt die Absender-WebContents, sodass nur das Hauptfenster sich selbst minimieren/schließen kann. Der OLED-Intro-Status wird sofort persistiert, ein Crash kurz nach App-Start triggert die Voreinstellung nicht erneut. Sidebar-Einträge in claude.ai sind im OLED nicht mehr als einzelne Kacheln sichtbar, sondern flach mit dezentem Hover. Popup-Menüs (Account, Connectors) bekommen einen leicht abgesetzten Untergrund. Das Bug-Report-Fenster nutzt jetzt dieselben Theme-Farben wie die übrige App; der Senden-Knopf hat im "Modern"-Design jetzt den Orange-Magenta-Verlauf wie alle anderen Primary-Buttons.',
        en: 'Window-controls IPC now verifies the sender WebContents, so only the main window can minimize/close itself. The OLED intro flag is persisted immediately so a crash shortly after launch does not trigger the preselect again. claude.ai sidebar entries no longer appear as separate tiles in OLED, but render flat with a subtle hover. Popup menus (Account, Connectors) get a slightly offset background. The Bug Report window now uses the same theme colors as the rest of the app; the Send button in the "Modern" design gets the same orange-magenta gradient as all other primary buttons.'
      }
    }
  ],
  '1.3.13': [
    {
      icon: 'check',
      title: {
        de: 'Hilfe bei hängender Verifizierungs-Seite',
        en: 'In-page help when verification gets stuck'
      },
      text: {
        de: 'Bleibt die Cloudflare-Sicherheitsprüfung in einer Schleife hängen, erscheint nach einigen Sekunden ein Banner direkt auf der Seite. Ein Klick auf "Zurücksetzen" leert Cookies und Cache für claude.ai und lädt die Seite neu, ohne dass du den versteckten Menüpunkt suchen musst.',
        en: 'If the Cloudflare check loops, a banner now appears directly on the page after a few seconds. Clicking "Reset" clears claude.ai cookies and cache and reloads the page, no hidden menu entry required.'
      }
    },
    {
      icon: 'settings',
      title: {
        de: 'Info-Fenster im Menü',
        en: 'About window in the menu'
      },
      text: {
        de: 'Das Hamburger-Menü hat jetzt die Punkte "Über Claude Desktop" und "Was ist neu?". Das Info-Fenster zeigt Version, eine Kurzbeschreibung, Links zu GitHub und zum Anthropic-Support sowie den Markenhinweis. "Was ist neu?" lässt sich darüber jederzeit öffnen, nicht mehr nur nach einem Update.',
        en: 'The hamburger menu now has "About Claude Desktop" and "What’s new?" entries. The About window shows the version, a short description, links to GitHub and Anthropic Support, plus the trademark notice. "What’s new?" can be opened any time from there, not just after an update.'
      }
    }
  ],
  '1.3.12': [
    {
      icon: 'check',
      title: {
        de: 'Higgsfield-Connector lässt sich verbinden',
        en: 'Higgsfield connector can be linked'
      },
      text: {
        de: 'Beim Klick auf "Connect" / "Accept" im Higgsfield-Connector-Dialog auf claude.ai passierte vorher nichts Sichtbares. Ursache: `higgsfield.ai` war in der OAuth-Allowlist nicht eingetragen, daher wurde das Auth-Popup in den Systembrowser umgeleitet, wo der Callback zurück zur App nicht ankam. `higgsfield.ai` und Subdomains gelten jetzt als OAuth-Domain — das Popup öffnet in der App, Callback landet in derselben Session.',
        en: 'Clicking "Connect" / "Accept" in the Higgsfield connector dialog on claude.ai previously did nothing visible. Cause: `higgsfield.ai` was not in the OAuth allowlist, so the auth popup was redirected to the system browser where the callback never reached the app. `higgsfield.ai` and its subdomains now count as OAuth domains, the popup opens inside the app, and the callback lands in the same session.'
      }
    },
    {
      icon: 'check',
      title: {
        de: 'Bug-Report-Dialog: Buttons nicht mehr abgeschnitten',
        en: 'Bug Report dialog: buttons no longer cut off'
      },
      text: {
        de: 'Der in 1.3.11 hinzugefügte Browser-Gegencheck-Hinweis hat den Disclaimer-Block länger gemacht, die Fensterhöhe (760 px) blieb aber gleich – "Abbrechen" und "Bericht senden" waren je nach Skalierung halb oder ganz unten weggeschnitten. Höhe von 760 auf 860 px erhöht.',
        en: 'The browser-cross-check note added in 1.3.11 made the disclaimer block longer, but the window height (760 px) stayed the same, so "Cancel" and "Send report" were partly or fully cut off depending on scaling. Height bumped from 760 to 860 px.'
      }
    },
    {
      icon: 'bug',
      title: {
        de: 'Kleine Aufräumarbeiten',
        en: 'Small cleanups'
      },
      text: {
        de: 'mailto:-Links aus claude.ai öffnen jetzt auch dann den Mail-Client, wenn sie aus der Navigation kommen (vorher nur aus `window.open()`). Außerdem interne Kommentar-Aufräumung in main.js; rein kosmetisch.',
        en: 'mailto: links from claude.ai now open the mail client even when they come from navigation events (previously only from `window.open()`). Plus internal comment cleanup in main.js; cosmetic only.'
      }
    }
  ],
  '1.3.11': [
    {
      icon: 'check',
      title: {
        de: 'Cloudflare-Verifizierungsschleife behoben',
        en: 'Cloudflare verification loop fixed'
      },
      text: {
        de: 'Manche Nutzer blieben auf der Seite "Performing security verification" / "Verifying you are human" hängen. Drei Ursachen wurden gefixt: (1) Der Cloudflare-Turnstile-iframe (`challenges.cloudflare.com`) war in der internen Allowlist nicht eingetragen und wurde von `will-frame-navigate` blockiert – die Challenge konnte nie fertig werden. (2) Die UA-Header (inkl. Sec-Ch-Ua) wurden nur für `claude.ai` gesetzt, nicht für Sandbox-Origins, `*.anthropic.com` oder den Challenge-Endpunkt – was Cloudflare als Bot-Signal wertet. (3) `Sec-Ch-Ua-Full-Version-List` und `Sec-Ch-Ua-Platform-Version` fehlten (bekannter Electron-Bug #34762) und werden nun konsistent mit identischer Brand-Reihenfolge mitgesendet.',
        en: 'Some users got stuck on the "Performing security verification" / "Verifying you are human" page. Three root causes were fixed: (1) The Cloudflare Turnstile iframe (`challenges.cloudflare.com`) was missing from the internal allowlist and was blocked by `will-frame-navigate`, so the challenge could never finish. (2) UA headers (incl. Sec-Ch-Ua) were only set for `claude.ai`, not for sandbox origins, `*.anthropic.com` or the challenge endpoint, which Cloudflare treats as a bot signal. (3) `Sec-Ch-Ua-Full-Version-List` and `Sec-Ch-Ua-Platform-Version` were missing (known Electron bug #34762) and are now sent consistently with identical brand ordering.'
      }
    },
    {
      icon: 'bug',
      title: {
        de: 'Bug-Report: Hinweis zum Browser-Gegencheck',
        en: 'Bug Report: browser cross-check note'
      },
      text: {
        de: 'Der Bug-Report-Dialog zeigt jetzt unter dem Community-App-Hinweis einen kurzen Gegencheck: "Tritt der gleiche Fehler auch auf claude.ai in einem normalen Browser auf? Dann ist es ein serverseitiges Problem bei Anthropic und kein Wrapper-Bug." Reduziert Berichte zu Problemen wie der jüngsten "Could not load connectors directory"-Meldung, die auch im offiziellen Claude-Desktop und in regulären Browsern auftritt.',
        en: 'The Bug Report dialog now shows a quick cross-check below the community-app note: "Does the same error also happen on claude.ai in a regular browser? Then it is a server-side issue at Anthropic, not a wrapper bug." Cuts down on reports like the recent "Could not load connectors directory" message, which also shows up in the official Claude Desktop and in plain browsers.'
      }
    }
  ],
  '1.3.10': [
    {
      icon: 'check',
      title: {
        de: 'MCP-Connectoren (Visualize & Co.) funktionieren wieder',
        en: 'MCP connectors (Visualize & co.) work again'
      },
      text: {
        de: 'Wer in claude.ai einen MCP-Connector wie Visualize oder \u00e4hnliche aktiviert hat, sah zuvor die Fehlermeldung \u201eFailed to set up MCP app \u2013 check that claudemcpcontent.com is not blocked by your network or browser". Ursache war keine Netzsperre, sondern die App selbst: die Domain `claudemcpcontent.com` (separater Sandbox-Origin f\u00fcr MCP-Inhalte, analog zu `claudeusercontent.com` f\u00fcr Artifacts) war in der internen Allowlist nicht eingetragen. Behoben \u2013 MCP-iframes laden wieder, prophylaktisch auch `claudemcp.com` mit drin.',
        en: 'Anyone who enabled an MCP connector like Visualize in claude.ai previously saw the error "Failed to set up MCP app \u2013 check that claudemcpcontent.com is not blocked by your network or browser". The cause was not a network block but the app itself: the domain `claudemcpcontent.com` (a separate sandbox origin for MCP content, like `claudeusercontent.com` for Artifacts) was missing from the internal allowlist. Fixed \u2013 MCP iframes load again, with `claudemcp.com` added preemptively.'
      }
    },
    {
      icon: 'bug',
      title: {
        de: 'Neue Diagnose-Funktion im App-Men\u00fc',
        en: 'New diagnostics action in the app menu'
      },
      text: {
        de: 'Im Hamburger-Men\u00fc gibt es jetzt den Punkt \u201eDiagnose-Info kopieren". Er sammelt App-Version, Electron/Chrome-Build, Kernel, Display-Session, GPU-Vendor und WebGL-Renderer in einem Block und kopiert ihn in die Zwischenablage \u2013 hilfreich, wenn z.B. eine Cloudflare-Verifizierungs-Seite h\u00e4ngen bleibt und der Fehler genauer reproduziert werden soll.',
        en: 'The hamburger menu now has a "Copy diagnostics info" entry. It gathers app version, Electron/Chrome build, kernel, display session, GPU vendor and WebGL renderer into one block and copies it to the clipboard \u2013 useful when, for example, a Cloudflare verification page hangs and the error needs to be reproduced in detail.'
      }
    },
    {
      icon: 'check',
      title: {
        de: 'Selbsthilfe bei h\u00e4ngender claude.ai-Verifizierung',
        en: 'Self-help for stuck claude.ai verification'
      },
      text: {
        de: 'Ebenfalls neu im Men\u00fc: \u201eclaude.ai-Verifizierung zur\u00fccksetzen". L\u00f6scht Cookies und Cache f\u00fcr alle claude.ai-Origins und l\u00e4dt die Seite neu. Sinnvoll, falls die Cloudflare-Sicherheits\u00fcberpr\u00fcfung (\u201ePerforming security verification") in einer Schleife stecken bleibt. Erfordert anschlie\u00dfend einen erneuten Login.',
        en: 'Also new in the menu: "Reset claude.ai verification". Clears cookies and cache for all claude.ai origins and reloads the page. Useful when the Cloudflare security check ("Performing security verification") gets stuck in a loop. Requires you to sign in again afterwards.'
      }
    }
  ]
};

module.exports = { RELEASE_NOTES, RELEASE_NOTES_REVISIT };

const { compareVersions } = require('./utils/pure');

// isSnap kommt als Parameter statt aus dem Modul-Scope, damit die Funktion ohne
// Electron testbar bleibt.
function getFilteredNotes(currentVersion, lastSeenVersion, { isSnap = false, force = false } = {}) {
  const all = Object.keys(RELEASE_NOTES);
  let versionsToShow;
  if (force || !lastSeenVersion) {
    versionsToShow = all.includes(currentVersion) ? [currentVersion] : [];
  } else {
    versionsToShow = all
      .filter(v => compareVersions(v, lastSeenVersion) > 0 && compareVersions(v, currentVersion) <= 0)
      .sort(compareVersions);
  }
  // Revisit: wenn die aktuelle Version in unserer Map steht und auch tatsächlich
  // angezeigt wird, ziehen wir die referenzierten älteren Versionen mit rein.
  const revisit = RELEASE_NOTES_REVISIT[currentVersion];
  if (Array.isArray(revisit) && versionsToShow.includes(currentVersion)) {
    for (const r of revisit) {
      if (!versionsToShow.includes(r) && RELEASE_NOTES[r]) versionsToShow.push(r);
    }
    versionsToShow.sort(compareVersions);
  }
  const notes = [];
  for (const v of versionsToShow) {
    for (const n of (RELEASE_NOTES[v] || [])) {
      if (n.if === 'snap' && !isSnap) continue;
      if (n.if === 'appimage' && isSnap) continue;
      notes.push(n);
    }
  }
  return notes;
}

module.exports.getFilteredNotes = getFilteredNotes;
