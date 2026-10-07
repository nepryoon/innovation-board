// Italian text for the Innovation Board demo. Only words live here: ids, numbers, ranges, roles and
// source types come from data.js, so both locales share one structure and compute the same results.
// Amounts keep the same numeric values and are shown in euro. Everything is fictional, as in data.js.

export const COMPANY_IT = {
  name: "Brindlecote Systems (fittizia)",
  sector: "Software B2B: pianificazione e gestione degli interventi per le imprese di manutenzione degli edifici",
  size: "240 dipendenti, 1.100 aziende clienti, 21 mln € di ricavi ricorrenti annui",
  priorities: [
    "Aumentare i ricavi dai clienti esistenti con add-on per i prodotti attuali",
    "Ridurre il costo del servizio nell'assistenza clienti e nell'amministrazione",
    "Mantenere affidabile la piattaforma principale ed evitare scommesse che richiedano un nuovo canale di vendita"
  ],
  products: [
    "Brindle Dispatch: pianificazione degli interventi per le imprese di manutenzione",
    "Brindle Field: l'app mobile per i tecnici",
    "Brindle Ledger: fatturazione e pagamenti"
  ],
  capacity: "Il prossimo trimestre un team di prodotto di 5 persone sarà libero per una nuova iniziativa, con 4 giorni produttivi a settimana ciascuno.",
  rateCard: {
    pm: "Product manager",
    engineer: "Sviluppatore software",
    data: "Data engineer",
    designer: "Designer",
    qa: "Tester QA"
  }
};

export const POLICY_NOTE_IT = "Il codice classifica ogni idea in base a queste soglie. Il Presidente può suggerire una fascia; se la regola non concorda, prevale la regola e la pagina lo segnala.";

export const TIERS_IT = {
  invest: "Investire ora",
  pilot: "Avviare un progetto pilota",
  explore: "Approfondire",
  park: "Accantonare"
};

export const AGENT_ROLES_IT = {
  strategy: "Responsabile strategia",
  market: "Analista di mercato",
  delivery: "Responsabile delivery",
  finance: "Analista finanziario",
  auditor: "Auditor delle evidenze",
  chair: "Presidente"
};

export const DIMENSION_LABELS_IT = {
  fit: "Coerenza strategica",
  market: "Domanda di mercato",
  feasibility: "Fattibilità",
  risk: "Rischio (5 = basso)"
};

export const SOURCE_TYPE_LABELS_IT = {
  interview: "Intervista a un cliente",
  survey: "Sondaggio",
  "sales-data": "Dati commerciali interni",
  "support-data": "Dati interni dell'assistenza",
  "internal-data": "Dati operativi interni",
  spike: "Spike tecnico",
  "market-report": "Estratto di report di mercato",
  competitor: "Note sui concorrenti",
  "trend-article": "Articolo di tendenza",
  "vendor-blog": "Blog di un fornitore",
  keynote: "Sintesi di un keynote"
};

export const IDEAS_IT = {
  "inspection-planner": {
    title: "Scadenzario Verifiche",
    tagline: "Add-on che pianifica le verifiche obbligatorie e sollecita i certificati",
    profile: "Bisogno ben documentato, buona coerenza strategica",
    pitch: "Un add-on di Brindle Dispatch che pianifica le verifiche periodiche obbligatorie (impianti di allarme antincendio, illuminazione di emergenza, apparecchi a gas) su tutti i siti dei clienti di un'impresa, archivia i certificati e avvisa prima delle scadenze. Oggi le imprese gestiscono queste scadenze in fogli di calcolo, a parte rispetto al nostro prodotto. Verrebbe venduto ai clienti esistenti come add-on annuale per azienda cliente.",
    unit: "azienda cliente",
    assumptions: {
      price: "Prezzo per azienda cliente all'anno",
      adoption: "Nuove aziende clienti all'anno",
      churn: "Churn annuo",
      running: "Costo di esercizio annuo"
    },
    workPackages: {
      w1: "Regole delle verifiche e motore di pianificazione",
      w2: "Archivio certificati e promemoria delle scadenze",
      w3: "Integrazione con Dispatch e migrazione dei fogli di calcolo",
      w4: "Schermate di pianificazione e test di usabilità",
      w5: "Test e supporto al progetto pilota"
    },
    experiments: {
      x1: "Pagina di preordine dell'add-on mostrata a 300 aziende clienti",
      x2: "Offerta a due prezzi a 40 account tramite gli account manager",
      x3: "Test di migrazione sui fogli di calcolo reali delle verifiche di 10 clienti"
    },
    sources: {
      s1: { title: "Analisi delle trattative perse, primo semestre 2026",
        text: "Nel primo semestre 2026 l'area commerciale ha registrato 214 trattative perse o ferme. In 61 di queste il potenziale cliente ha indicato la gestione delle verifiche come una lacuna, soprattutto per i controlli su allarmi antincendio e illuminazione di emergenza. Sono stati citati tre concorrenti che la offrono. Gli account manager stimano che i clienti esistenti accetterebbero un add-on con un prezzo tra 1.500 € e 2.400 € all'anno." },
      s2: { title: "Temi dei ticket di assistenza, 12 mesi fino a giugno 2026",
        text: "Su 9.800 ticket di assistenza, 1.240 chiedevano come pianificare verifiche ricorrenti o allegare certificati agli interventi. Oggi gli operatori suggeriscono soluzioni di ripiego con interventi ricorrenti, che saltano quando cambia un sito del cliente. Il tempo mediano di gestione di questi ticket è di 22 minuti, contro una mediana complessiva di 14 minuti." },
      s3: { title: "Intervista a un cliente: impresa regionale di sicurezza antincendio",
        text: "Seguiamo circa tremila scadenze di verifica in due fogli di calcolo e su una lavagna. Se ne saltiamo una perdiamo il contratto, non è solo una multa. Se Dispatch pianificasse le verifiche e sollecitasse i certificati, lo pagherei da domani, a patto che legga l'elenco dei siti che abbiamo già. I nostri coordinatori smetterebbero di ricontrollare le date ogni venerdì." },
      s4: { title: "Intervista a un cliente: piccola impresa di manutenzione edile",
        text: "Le verifiche saranno un quinto del nostro lavoro. Sinceramente, il nostro foglio di calcolo funziona quasi sempre. Prima di pagare di più vorrei vedere che fa risparmiare al mio coordinatore una giornata a settimana. Per noi il prezzo conta più delle funzionalità, e paghiamo già tre add-on che usiamo pochissimo." },
      s5: { title: "Sondaggio clienti, maggio 2026 (212 aziende clienti)",
        text: "Il 58% dei rispondenti gestisce le verifiche obbligatorie per conto dei propri clienti. Di questi, il 41% indica uno scadenzario delle verifiche integrato come la funzionalità più desiderata. Il 34% dichiara che probabilmente lo acquisterebbe come add-on e il 12% che lo acquisterebbe di sicuro. Le aziende con più di 50 tecnici avevano il doppio di probabilità di rispondere “di sicuro”." },
      s6: { title: "Nota previsionale del customer success",
        text: "Il customer success ha esaminato il sondaggio con gli account manager. Prevede che tra 80 e 160 aziende clienti adottino l'add-on in ciascuno dei primi tre anni, se viene lanciato su tutta la base clienti. Add-on analoghi hanno perso tra il 5% e il 10% degli abbonati all'anno. Due grandi clienti hanno chiesto per iscritto una data di lancio." },
      s7: { title: "Estratto di report di settore: software per la conformità nella manutenzione",
        text: "La pianificazione delle attività di conformità sta diventando un requisito standard nelle gare per i software di manutenzione. Gli acquirenti chiedono sempre più spesso la tracciabilità dei certificati di verifica. Il report stima il segmento in 140 mln €, ma avverte che la stima si basa sui ricavi dichiarati dai fornitori e potrebbe contare due volte i prodotti venduti in bundle." },
      s8: { title: "Note sui concorrenti: due prodotti di pianificazione rivali",
        text: "Un concorrente ha lanciato l'anno scorso un modulo per le verifiche, incluso nel piano più costoso. I clienti che abbiamo intervistato lo descrivono come rigido: le regole non possono variare da un sito all'altro. Un secondo concorrente offre solo promemoria, senza archiviazione dei certificati. Nessuno dei due si integra con un'app per i tecnici, che è proprio dove i certificati vengono acquisiti." },
      s9: { title: "Spike tecnico: motore di pianificazione delle verifiche",
        text: "Un breve spike ha realizzato un motore di regole per 12 tipi di verifica sul modello di intervento esistente. Ricorrenze e scadenze dei certificati hanno funzionato bene. La migrazione dei fogli di calcolo dei clienti no, perché i nomi dei siti raramente corrispondono ai nostri archivi. Il costo di esercizio è stimato tra 50.000 € e 80.000 € all'anno, soprattutto per archiviazione e assistenza." }
    }
  },
  "field-copilot": {
    title: "Copilota AI per i tecnici",
    tagline: "Assistente di AI generativa che diagnostica i guasti da foto e messaggi vocali",
    profile: "Idea di tendenza, domanda poco dimostrata",
    pitch: "Un assistente di AI generativa dentro Brindle Field che ascolta i tecnici, guarda le foto delle apparecchiature guaste, diagnostica il guasto sul posto e scrive in automatico il rapporto di intervento. Presentato come un salto rivoluzionario: un esperto autonomo in tasca a ogni tecnico, venduto come add-on premium che ci porta davanti all'ondata di AI destinata a ridisegnare il settore.",
    unit: "azienda cliente",
    assumptions: {
      price: "Prezzo per azienda cliente all'anno",
      adoption: "Nuove aziende clienti all'anno",
      churn: "Churn annuo",
      running: "Costo di esercizio annuo"
    },
    workPackages: {
      w1: "Modelli di diagnosi da foto e voce",
      w2: "Raccolta di dati etichettati sui guasti",
      w3: "Esperienza del copilota nell'app mobile",
      w4: "Generazione dei rapporti e integrazione con gli interventi",
      w5: "Revisione di sicurezza e prove sul campo"
    },
    experiments: {
      x1: "Test concierge: una persona scrive i rapporti di intervento dalle note vocali per 5 aziende",
      x2: "Test di accuratezza su 2.000 foto di guasti etichettate",
      x3: "Interviste sulla disponibilità a pagare con 12 aziende clienti"
    },
    sources: {
      s1: { title: "Articolo di tendenza: “Il tecnico autonomo è già qui”",
        text: "L'AI generativa trasformerà l'assistenza sul campo fino a renderla irriconoscibile. Secondo gli osservatori del settore, il mercato dell'AI per l'assistenza sul campo raggiungerà 48 miliardi di euro entro il 2030, con una crescita del 37% all'anno. I primi utilizzatori riportano un aumento del 40% del tasso di risoluzione al primo intervento. Le imprese che aspettano rischiano di essere scavalcate da un'ondata di concorrenti nati con l'AI." },
      s2: { title: "Blog di un fornitore: copiloti per gli installatori",
        text: "I nostri clienti ci dicono che i copiloti si ripagano in 3 mesi. Un installatore ha ridotto del 90% il tempo di stesura dei rapporti dopo aver attivato le note vocali. Ogni tecnico merita un esperto in tasca, e la tecnologia è finalmente pronta per salire sul furgone." },
      s3: { title: "Sintesi di un keynote: il futuro della manutenzione",
        text: "Il keynote ha previsto che entro cinque anni il 70% degli interventi di manutenzione coinvolgerà un assistente AI. Il relatore ha esortato i fornitori di software a puntare tutto sugli agenti e ha sostenuto che i clienti pagheranno un sovrapprezzo per qualsiasi cosa porti l'etichetta AI. Per le previsioni non è stata indicata alcuna fonte di dati." },
      s4: { title: "Intervista a un cliente: impresa di impianti termoidraulici",
        text: "Sembra una cosa intelligente, ma i miei tecnici non si metteranno a parlare a un telefono nella cucina di un cliente. Quello che servirebbe è la stesura dei rapporti: porta via 20 minuti a intervento. Per la diagnosi non pagherei molto: i più esperti il guasto lo riconoscono da soli, e i nuovi chiamano un supervisore." },
      s5: { title: "Sondaggio lampo, luglio 2026 (14 aziende clienti)",
        text: "Su 14 aziende interpellate, cinque si sono dette interessate a un assistente AI per i tecnici, due hanno detto che lo pagherebbero e sette temono diagnosi sbagliate su guasti a impianti gas o elettrici. Quasi tutto l'interesse è venuto da aziende molto piccole. I rispondenti hanno indicato un prezzo tra 600 € e 1.500 € all'anno." },
      s6: { title: "Ticket di assistenza e richieste di funzionalità, 12 mesi fino a giugno 2026",
        text: "Tre dei 9.800 ticket di assistenza chiedevano funzionalità di AI. La stesura dei rapporti in Brindle Field ha generato 410 ticket, soprattutto per foto perse e caricamenti lenti con poco segnale. Nelle votazioni dei clienti le note vocali sono al 23° posto su 40 richieste di funzionalità, e nessuno ha chiesto la diagnosi da foto." },
      s7: { title: "Spike tecnico: diagnosi dei guasti da foto",
        text: "Uno spike ha testato un modello di visione generico su 300 foto etichettate di guasti a caldaie e allarmi. Ha individuato il guasto corretto nel 58% dei casi, e i tecnici hanno giudicato una risposta su cinque non sicura da seguire. Per un'accuratezza utile servirebbero molte più foto etichettate di quante ne abbiamo. Inferenza e revisione umana costerebbero tra 120.000 € e 220.000 € all'anno." },
      s8: { title: "Note sui concorrenti: annunci sull'AI",
        text: "Due concorrenti hanno annunciato assistenti AI quest'anno. Nessuno dei due ha pubblicato numeri sui clienti o risultati di accuratezza, e uno è ancora in beta con lista d'attesa. Un ex cliente di uno dei due ha definito l'assistente una demo, non uno strumento. Gli analisti prevedono per i primi add-on di AI un churn tra il 15% e il 35% all'anno, man mano che l'effetto novità svanisce." },
      s9: { title: "Nota sulla pipeline commerciale, giugno 2026",
        text: "I potenziali clienti chiedono dell'AI più o meno in una demo su quattro, di solito come domanda generica più che come requisito. Nessuna trattativa persa nel primo semestre 2026 ha indicato l'AI come motivo. Gli account manager ritengono che tra 10 e 60 aziende all'anno potrebbero acquistare un add-on AI premium, soprattutto tra le più piccole." }
    }
  },
  "payment-matching": {
    title: "Riconciliazione automatica dei pagamenti",
    tagline: "Servizio interno che abbina i pagamenti alle fatture per l'amministrazione",
    profile: "Efficienza interna poco appariscente, benefici modesti",
    pitch: "Un servizio interno che abbina automaticamente i pagamenti degli abbonamenti dei clienti alle fatture e passa all'amministrazione solo le eccezioni. Oggi due addetti amministrativi riconciliano a mano ogni mese la maggior parte dei conti. Non ci sono nuovi ricavi: il business case si regge sul tempo del personale risparmiato e su meno errori di fatturazione che arrivano ai clienti.",
    unit: "conto",
    assumptions: {
      price: "Risparmio per conto all'anno",
      adoption: "Conti passati all'abbinamento automatico all'anno",
      churn: "Conti tornati all'abbinamento manuale all'anno",
      running: "Costo di esercizio annuo"
    },
    workPackages: {
      w1: "Motore di regole di abbinamento",
      w2: "Importazione dei file bancari e flusso dati delle fatture",
      w3: "Schermata di revisione delle eccezioni per l'amministrazione",
      w4: "Esecuzione in parallelo e test",
      w5: "Avvio in amministrazione e formazione"
    },
    experiments: {
      x1: "Esecuzione ombra: abbinare un mese di pagamenti in parallelo al processo manuale",
      x2: "Progetto pilota sull'addebito diretto per 50 conti",
      x3: "Verifica del tasso di eccezioni su tre mesi di pagamenti parziali"
    },
    sources: {
      s1: { title: "Registro dei tempi dell'amministrazione, secondo trimestre 2026",
        text: "Nel trimestre due addetti amministrativi hanno dedicato il 41% del loro tempo alla riconciliazione dei pagamenti. Ogni conto richiede circa 25 minuti al mese di riconciliazione manuale. L'amministrazione stima un risparmio tra 110 € e 180 € per conto all'anno con l'abbinamento automatico, considerando il tempo del personale e il minor numero di note di credito." },
      s2: { title: "Intervista: responsabile delle operazioni amministrative",
        text: "Il collo di bottiglia è la chiusura di fine mese. Riconciliamo la sera per chiudere in tempo, e gli errori diventano solleciti sbagliati ai clienti. Non mi serve niente di sofisticato: abbinate quelli ovvi e mostratemi il resto. L'anno scorso il formato del file bancario è cambiato due volte, e le nostre macro hanno smesso di funzionare." },
      s3: { title: "Intervista: responsabile del team di assistenza clienti",
        text: "Le domande sulla fatturazione sono la nostra seconda categoria di ticket per volume. Quasi tutte nascono da un pagamento che abbiamo imputato alla fattura sbagliata. Se l'amministrazione abbinasse correttamente i pagamenti, credo che i ticket di fatturazione calerebbero in modo evidente, ma non saprei dare un numero e non lo prometterei." },
      s4: { title: "Analisi dei ticket di fatturazione, 12 mesi fino a giugno 2026",
        text: "I ticket di fatturazione sono stati 1.630, di cui 520 legati a pagamenti imputati in modo errato. Il tempo medio di gestione è stato di 19 minuti. I pagamenti imputati in modo errato hanno causato anche 140 solleciti sbagliati, e 9 clienti hanno citato errori di fatturazione al momento della disdetta dell'abbonamento. I responsabili dell'assistenza si aspettano che la maggior parte di questi casi sparisca quando l'abbinamento sarà affidabile." },
      s5: { title: "Spike tecnico: regole di abbinamento sui pagamenti storici",
        text: "Abbiamo rielaborato sei mesi di pagamenti confrontandoli con le fatture. Regole semplici su causale e importo hanno abbinato automaticamente l'82% dei pagamenti; l'abbinamento approssimativo sui nomi dei clienti ha aggiunto 9 punti, ma ha prodotto falsi abbinamenti che l'amministrazione deve verificare. Il costo di esercizio sarebbe tra 15.000 € e 30.000 € all'anno." },
      s6: { title: "Piano di estensione dell'amministrazione, bozza",
        text: "L'amministrazione propone di passare all'abbinamento automatico tra 250 e 400 conti all'anno, partendo dai clienti con addebito diretto, che hanno le causali più pulite. I conti con pagamenti irregolari resterebbero manuali. Il team prevede che ogni anno tra il 5% e il 15% dei conti trasferiti torni all'abbinamento manuale." },
      s7: { title: "Nota di benchmark: automazione amministrativa nelle software house di medie dimensioni",
        text: "Le software house di medie dimensioni che hanno automatizzato l'abbinamento dei pagamenti riportano chiusure di fine mese più brevi, in genere di due-quattro giorni. La nota avverte che i benefici dipendono da causali di pagamento pulite e che il tempo del personale risparmiato viene spesso destinato ad altre attività anziché tolto dal budget." },
      s8: { title: "Valutazione di strumenti di riconciliazione pronti all'uso",
        text: "L'amministrazione ha valutato due strumenti di riconciliazione pronti all'uso. Entrambi richiedono di esportare ogni notte i dati delle fatture, e le loro licenze costerebbero più che sviluppare internamente le regole di abbinamento. Nessuno dei due gestisce i nostri pagamenti parziali per contratti multisito, che sono il 12% delle fatture, quindi una coda manuale resterebbe comunque." },
      s9: { title: "Sondaggio rapido nel team amministrativo (sei persone)",
        text: "Tutte e sei le persone dell'amministrazione hanno indicato la riconciliazione come il compito più noioso. Quattro temono che l'automazione possa nascondere errori, a meno che le eccezioni non siano facili da verificare. Due hanno chiesto tempo per la formazione, che il responsabile del team stima in 3 giorni a persona. Nessuno si aspetta di perdere il proprio ruolo per questo." }
    }
  }
};
