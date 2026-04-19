import type { DetectedLanguage } from "./advisorTypes"

const LANGUAGE_MARKERS: Record<DetectedLanguage, string[]> = {
  es: ["hola", "buenos", "que", "cuanto", "precio", "quiero", "comprar", "riesgo", "mercado", "gracias", "donde", "mejor", "coche", "carro", "esta", "este", "informe", "analisis", "inversion", "dime", "ayuda", "por", "deberia", "como", "cuales", "necesito", "puedes", "dame"],
  fr: ["bonjour", "merci", "prix", "combien", "risque", "marche", "voiture", "acheter", "rapport", "investissement", "aidez", "meilleur", "quel", "quels"],
  pt: ["ola", "obrigado", "preco", "quanto", "risco", "mercado", "carro", "comprar", "relatorio", "investimento", "ajuda", "onde", "melhor", "quais"],
  de: ["hallo", "danke", "preis", "wieviel", "risiko", "markt", "auto", "kaufen", "bericht", "investition", "hilfe", "beste", "welche"],
  it: ["ciao", "grazie", "prezzo", "quanto", "rischio", "mercato", "comprare", "rapporto", "investimento", "aiuto", "dove", "migliore", "quali"],
  ja: ["konnichiwa", "arigatou", "kakaku", "ikura"],
  en: [],
}

export function detectLanguage(text: string): DetectedLanguage {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const words = lower.split(/\s+/)

  let bestLang: DetectedLanguage = "en"
  let bestScore = 0

  for (const [lang, markers] of Object.entries(LANGUAGE_MARKERS)) {
    if (lang === "en") continue
    const score = words.filter(w => markers.includes(w)).length
    if (score > bestScore) {
      bestScore = score
      bestLang = lang as DetectedLanguage
    }
  }

  return bestLang
}

export const GREETINGS: Record<DetectedLanguage, { morning: string; afternoon: string; evening: string }> = {
  en: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
  es: { morning: "Buenos días", afternoon: "Buenas tardes", evening: "Buenas noches" },
  fr: { morning: "Bonjour", afternoon: "Bon après-midi", evening: "Bonsoir" },
  pt: { morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite" },
  de: { morning: "Guten Morgen", afternoon: "Guten Tag", evening: "Guten Abend" },
  it: { morning: "Buongiorno", afternoon: "Buon pomeriggio", evening: "Buonasera" },
  ja: { morning: "おはようございます", afternoon: "こんにちは", evening: "こんばんは" },
}

type PhraseKey =
  | "advisorName" | "helping" | "analyzing" | "market"
  | "fairValue" | "currentBid" | "risks" | "strengths"
  | "comparables" | "ownershipCost" | "bestRegion"
  | "reportTitle" | "reportDesc" | "generateReport" | "viewReport" | "upgradeNeeded"
  | "askMore" | "showComps" | "getReport"
  | "isFairlyPriced" | "whatAreRisks" | "bestMarket" | "investmentReport"
  | "welcome" | "noCarContext" | "thanksReply" | "helpIntro"

const PHRASES: Record<DetectedLanguage, Record<PhraseKey, string>> = {
  en: {
    advisorName: "Monza Advisor",
    helping: "Helping",
    analyzing: "Analyzing",
    market: "market",
    fairValue: "Fair Value",
    currentBid: "Current bid",
    risks: "Risk Factors",
    strengths: "Strengths",
    comparables: "Comparable Sales",
    ownershipCost: "Annual Ownership Cost",
    bestRegion: "Regional Comparison",
    reportTitle: "Full Investment Report",
    reportDesc: "Includes valuation, comparable sales, risk analysis, and ownership cost projections",
    generateReport: "Generate Report",
    viewReport: "View Report",
    upgradeNeeded: "Upgrade your plan to generate reports",
    askMore: "Tell me more",
    showComps: "Show comparables",
    getReport: "Get full report",
    isFairlyPriced: "Is this fairly priced?",
    whatAreRisks: "What are the risks?",
    bestMarket: "Best market to buy?",
    investmentReport: "Get investment report",
    welcome: "I'm your specialist for collector car acquisitions. How may I help?",
    noCarContext: "Select a specific vehicle to get detailed analysis.",
    thanksReply: "You're welcome! I'm here anytime you need more analysis.",
    helpIntro: "I can help you with:",
  },
  es: {
    advisorName: "Monza Advisor",
    helping: "Ayudando a",
    analyzing: "Analizando",
    market: "mercado",
    fairValue: "Valor Justo",
    currentBid: "Oferta actual",
    risks: "Factores de Riesgo",
    strengths: "Fortalezas",
    comparables: "Ventas Comparables",
    ownershipCost: "Costo Anual de Propiedad",
    bestRegion: "Comparación Regional",
    reportTitle: "Reporte Completo de Inversión",
    reportDesc: "Incluye valuación, comparables, análisis de riesgo y proyecciones de costo",
    generateReport: "Generar Reporte",
    viewReport: "Ver Reporte",
    upgradeNeeded: "Actualiza tu plan para generar reportes",
    askMore: "Cuéntame más",
    showComps: "Ver comparables",
    getReport: "Obtener reporte",
    isFairlyPriced: "¿Está a buen precio?",
    whatAreRisks: "¿Cuáles son los riesgos?",
    bestMarket: "¿Mejor mercado para comprar?",
    investmentReport: "Obtener reporte de inversión",
    welcome: "Soy tu especialista en adquisición de autos de colección. ¿En qué puedo ayudarte?",
    noCarContext: "Selecciona un vehículo específico para obtener un análisis detallado.",
    thanksReply: "¡De nada! Estoy aquí cuando necesites más análisis.",
    helpIntro: "Puedo ayudarte con:",
  },
  fr: {
    advisorName: "Monza Advisor",
    helping: "Aide pour",
    analyzing: "Analyse du",
    market: "marché",
    fairValue: "Juste Valeur",
    currentBid: "Offre actuelle",
    risks: "Facteurs de Risque",
    strengths: "Points Forts",
    comparables: "Ventes Comparables",
    ownershipCost: "Coût Annuel",
    bestRegion: "Comparaison Régionale",
    reportTitle: "Rapport Complet d'Investissement",
    reportDesc: "Évaluation, comparables, analyse de risque et projections",
    generateReport: "Générer le Rapport",
    viewReport: "Voir le Rapport",
    upgradeNeeded: "Passez à Pro pour générer des rapports",
    askMore: "En savoir plus",
    showComps: "Voir les comparables",
    getReport: "Obtenir le rapport",
    isFairlyPriced: "Est-ce un bon prix?",
    whatAreRisks: "Quels sont les risques?",
    bestMarket: "Meilleur marché?",
    investmentReport: "Rapport d'investissement",
    welcome: "Je suis votre spécialiste en voitures de collection. Comment puis-je vous aider?",
    noCarContext: "Sélectionnez un véhicule spécifique pour une analyse détaillée.",
    thanksReply: "De rien! Je suis là quand vous avez besoin d'aide.",
    helpIntro: "Je peux vous aider avec:",
  },
  pt: {
    advisorName: "Monza Advisor",
    helping: "Ajudando",
    analyzing: "Analisando",
    market: "mercado",
    fairValue: "Valor Justo",
    currentBid: "Oferta atual",
    risks: "Fatores de Risco",
    strengths: "Pontos Fortes",
    comparables: "Vendas Comparáveis",
    ownershipCost: "Custo Anual",
    bestRegion: "Comparação Regional",
    reportTitle: "Relatório Completo de Investimento",
    reportDesc: "Avaliação, comparáveis, análise de risco e projeções",
    generateReport: "Gerar Relatório",
    viewReport: "Ver Relatório",
    upgradeNeeded: "Atualize para gerar relatórios",
    askMore: "Conte mais",
    showComps: "Ver comparáveis",
    getReport: "Obter relatório",
    isFairlyPriced: "Bom preço?",
    whatAreRisks: "Quais os riscos?",
    bestMarket: "Melhor mercado?",
    investmentReport: "Relatório de investimento",
    welcome: "Sou seu especialista em carros de coleção. Como posso ajudar?",
    noCarContext: "Selecione um veículo específico para análise detalhada.",
    thanksReply: "De nada! Estou aqui quando precisar.",
    helpIntro: "Posso ajudar com:",
  },
  de: {
    advisorName: "Monza Advisor",
    helping: "Hilft",
    analyzing: "Analysiert",
    market: "Markt",
    fairValue: "Fairer Wert",
    currentBid: "Aktuelles Gebot",
    risks: "Risikofaktoren",
    strengths: "Stärken",
    comparables: "Vergleichsverkäufe",
    ownershipCost: "Jährliche Kosten",
    bestRegion: "Regionaler Vergleich",
    reportTitle: "Vollständiger Investitionsbericht",
    reportDesc: "Bewertung, Vergleiche, Risikoanalyse und Kostenprognosen",
    generateReport: "Bericht Erstellen",
    viewReport: "Bericht Ansehen",
    upgradeNeeded: "Upgrade für Berichte",
    askMore: "Mehr erfahren",
    showComps: "Vergleiche zeigen",
    getReport: "Bericht erhalten",
    isFairlyPriced: "Guter Preis?",
    whatAreRisks: "Welche Risiken?",
    bestMarket: "Bester Markt?",
    investmentReport: "Investitionsbericht",
    welcome: "Ich bin Ihr Spezialist für Sammlerfahrzeuge. Wie kann ich helfen?",
    noCarContext: "Wählen Sie ein Fahrzeug für eine detaillierte Analyse.",
    thanksReply: "Gerne! Ich bin jederzeit für Sie da.",
    helpIntro: "Ich kann Ihnen helfen mit:",
  },
  it: {
    advisorName: "Monza Advisor",
    helping: "Aiutando",
    analyzing: "Analizzando",
    market: "mercato",
    fairValue: "Valore Giusto",
    currentBid: "Offerta attuale",
    risks: "Fattori di Rischio",
    strengths: "Punti di Forza",
    comparables: "Vendite Comparabili",
    ownershipCost: "Costo Annuale",
    bestRegion: "Confronto Regionale",
    reportTitle: "Rapporto Completo di Investimento",
    reportDesc: "Valutazione, comparabili, analisi rischio e proiezioni",
    generateReport: "Genera Rapporto",
    viewReport: "Vedi Rapporto",
    upgradeNeeded: "Aggiorna per generare rapporti",
    askMore: "Dimmi di più",
    showComps: "Mostra comparabili",
    getReport: "Ottieni rapporto",
    isFairlyPriced: "Buon prezzo?",
    whatAreRisks: "Quali rischi?",
    bestMarket: "Miglior mercato?",
    investmentReport: "Rapporto investimento",
    welcome: "Sono il tuo specialista in auto da collezione. Come posso aiutarti?",
    noCarContext: "Seleziona un veicolo specifico per un'analisi dettagliata.",
    thanksReply: "Prego! Sono qui quando hai bisogno.",
    helpIntro: "Posso aiutarti con:",
  },
  ja: {
    advisorName: "Monza Advisor",
    helping: "サポート中",
    analyzing: "分析中",
    market: "マーケット",
    fairValue: "適正価格",
    currentBid: "現在の入札",
    risks: "リスク要因",
    strengths: "強み",
    comparables: "類似取引",
    ownershipCost: "年間維持費",
    bestRegion: "地域比較",
    reportTitle: "投資レポート",
    reportDesc: "評価、類似取引、リスク分析、コスト予測を含む",
    generateReport: "レポート生成",
    viewReport: "レポートを見る",
    upgradeNeeded: "アップグレードが必要です",
    askMore: "詳しく",
    showComps: "類似取引",
    getReport: "レポート取得",
    isFairlyPriced: "適正価格？",
    whatAreRisks: "リスクは？",
    bestMarket: "最適市場は？",
    investmentReport: "投資レポート",
    welcome: "コレクターカーの専門家です。どのようにお手伝いできますか？",
    noCarContext: "詳細分析のために車両を選択してください。",
    thanksReply: "どういたしまして！いつでもお手伝いします。",
    helpIntro: "以下についてお手伝いできます：",
  },
}

export function getTimeGreeting(lang: DetectedLanguage): string {
  const hour = new Date().getHours()
  const g = GREETINGS[lang]
  if (hour < 12) return g.morning
  if (hour < 18) return g.afternoon
  return g.evening
}

export function t(lang: DetectedLanguage, key: PhraseKey): string {
  return PHRASES[lang]?.[key] || PHRASES.en[key] || key
}
