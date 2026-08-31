import React from 'react';
import { SupportedLanguage } from '../i18n/types';
import { 
  HelpCircle, Layers, Sparkles, Coins, Bot, ShieldCheck, Gift, 
  Lock
} from 'lucide-react';

export type FaqCategory = 
  | 'ALL'
  | 'BASICS'
  | 'CREATOR_REWARDS'
  | 'DEPOSITS_PAYOUTS'
  | 'AI_CUSTODIAN_ESCROW'
  | 'SECURITY_FDIC'
  | 'AD_CAMPAIGNS';

export interface LocalizedFaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: React.ReactNode;
  tags: string[];
}

export interface FaqCategoryInfo {
  id: FaqCategory;
  label: string;
  icon: React.FC<{ className?: string }>;
}

export interface FaqUiText {
  badge: string;
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  clear: string;
  noResultsTitle: string;
  noResultsDesc: string;
  resetFilters: string;
  stillHaveQuestions: string;
  aiSupportBadge: string;
  askLainieBanner: string;
  askLainieBtn: string;
  viewRulesBtn: string;
  contactSupportBtn: string;
}

export const FAQ_UI_TEXT: Record<SupportedLanguage, FaqUiText> = {
  en: {
    badge: 'Help Center & Knowledge Base',
    title: 'Frequently Asked Questions',
    subtitle: 'Everything you need to know about Mutual Savings Pods, the 3% Creator Host Reward, FDIC pass-through security, and Autonomous AI Custodianship.',
    searchPlaceholder: 'Search questions by keyword (e.g. Creator Reward, FDIC, Defaults, Lainie AI, Fees, Payouts)...',
    clear: 'Clear',
    noResultsTitle: 'No matching questions found',
    noResultsDesc: 'Try searching for a different keyword or browse through the category filters above.',
    resetFilters: 'Reset Search Filters',
    stillHaveQuestions: 'Still have questions?',
    aiSupportBadge: '24/7 AI & Support',
    askLainieBanner: 'Need immediate voice answers? Ask Lainie AI Voice Guide — fully trained on this entire FAQ knowledge base.',
    askLainieBtn: 'Ask Lainie AI',
    viewRulesBtn: 'View Rules',
    contactSupportBtn: 'Contact Help Desk',
  },
  es: {
    badge: 'Centro de Ayuda y Base de Conocimiento',
    title: 'Preguntas Frecuentes',
    subtitle: 'Todo lo que necesitas saber sobre los Grupos de Ahorro Mutuo, la Recompensa de Anfitrión del 3%, la seguridad FDIC y la Custodia Autónoma por IA.',
    searchPlaceholder: 'Buscar preguntas por palabra clave (ej. Recompensa Creador, FDIC, Impagos, Lainie AI, Tarifas, Pagos)...',
    clear: 'Borrar',
    noResultsTitle: 'No se encontraron preguntas coincidentes',
    noResultsDesc: 'Intenta buscar con otra palabra clave o explora las categorías anteriores.',
    resetFilters: 'Restablecer Filtros de Búsqueda',
    stillHaveQuestions: '¿Aún tienes preguntas?',
    aiSupportBadge: 'IA y Soporte 24/7',
    askLainieBanner: '¿Prefieres consultar por voz? Pregúntale a Lainie AI — entrenada con toda esta Base de Conocimiento FAQ.',
    askLainieBtn: 'Preguntar a Lainie AI',
    viewRulesBtn: 'Ver Reglas',
    contactSupportBtn: 'Contactar Soporte',
  },
  fr: {
    badge: 'Centre d\'Aide & Base de Connaissances',
    title: 'Foire Aux Questions',
    subtitle: 'Tout ce que vous devez savoir sur les Groupes d\'Épargne Mutuelle, la Prime Créateur de 3%, la garantie indirecte FDIC et la Gardienne IA Autonome.',
    searchPlaceholder: 'Rechercher par mot-clé (ex. Prime Créateur, FDIC, Impayés, Lainie AI, Frais, Versements)...',
    clear: 'Effacer',
    noResultsTitle: 'Aucune question correspondante trouvée',
    noResultsDesc: 'Essayez avec un autre mot-clé ou explorez les filtres de catégories ci-dessus.',
    resetFilters: 'Réinitialiser les Filtres',
    stillHaveQuestions: 'Vous avez encore des questions ?',
    aiSupportBadge: 'IA & Support 24/7',
    askLainieBanner: 'Besoin d\'une réponse vocale directe ? Demandez à Lainie AI — alimentée par toute cette Base de Connaissances FAQ.',
    askLainieBtn: 'Demander à Lainie AI',
    viewRulesBtn: 'Voir le Règlement',
    contactSupportBtn: 'Contacter le Support',
  },
};

export const FAQ_CATEGORIES: Record<SupportedLanguage, FaqCategoryInfo[]> = {
  en: [
    { id: 'ALL', label: 'All Questions', icon: HelpCircle },
    { id: 'BASICS', label: 'Basics & ROSCAs', icon: Layers },
    { id: 'CREATOR_REWARDS', label: 'Creator Host Rewards (3%)', icon: Sparkles },
    { id: 'DEPOSITS_PAYOUTS', label: 'Deposits, Payouts & Fees', icon: Coins },
    { id: 'AI_CUSTODIAN_ESCROW', label: 'AI Custodian & System Escrow', icon: Bot },
    { id: 'SECURITY_FDIC', label: 'FDIC & KYC Security', icon: ShieldCheck },
    { id: 'AD_CAMPAIGNS', label: 'Brand Gear & Extra Earnings', icon: Gift },
  ],
  es: [
    { id: 'ALL', label: 'Todas las Preguntas', icon: HelpCircle },
    { id: 'BASICS', label: 'Conceptos Básicos y ROSCA', icon: Layers },
    { id: 'CREATOR_REWARDS', label: 'Recompensas del Creador (3%)', icon: Sparkles },
    { id: 'DEPOSITS_PAYOUTS', label: 'Depósitos, Cobros y Tarifas', icon: Coins },
    { id: 'AI_CUSTODIAN_ESCROW', label: 'Custodia IA y Escrow del Sistema', icon: Bot },
    { id: 'SECURITY_FDIC', label: 'Seguridad FDIC y Verificación KYC', icon: ShieldCheck },
    { id: 'AD_CAMPAIGNS', label: 'Prendas de Marca e Ingresos Extra', icon: Gift },
  ],
  fr: [
    { id: 'ALL', label: 'Toutes les Questions', icon: HelpCircle },
    { id: 'BASICS', label: 'Bases & ROSCA / Tontines', icon: Layers },
    { id: 'CREATOR_REWARDS', label: 'Primes Créateur Hôte (3%)', icon: Sparkles },
    { id: 'DEPOSITS_PAYOUTS', label: 'Dépôts, Versements & Frais', icon: Coins },
    { id: 'AI_CUSTODIAN_ESCROW', label: 'Gardienne IA & Entiercement', icon: Bot },
    { id: 'SECURITY_FDIC', label: 'Sécurité FDIC & KYC', icon: ShieldCheck },
    { id: 'AD_CAMPAIGNS', label: 'Équipement de Marque & Revenus', icon: Gift },
  ],
};

export const getFaqItems = (lang: SupportedLanguage): LocalizedFaqItem[] => {
  if (lang === 'es') {
    return [
      {
        id: 'faq_rosca_basics',
        category: 'BASICS',
        question: '¿Qué es MutualPool y cómo funciona un Grupo de Ahorro Mutuo?',
        tags: ['rosca', 'tanda', 'susu', 'ajo', 'pardna', 'arisan', 'chit fund', 'conceptos', 'rotacion', 'pago', 'ahorro'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>MutualPool</strong> es una Asociación de Ahorro y Crédito Rotativo (ROSCA) entre pares modernizada—conocida culturalmente en todo el mundo como <em>tanda, susu, ajo, pardna, arisan o chit fund</em>—diseñada específicamente para repartidores independientes, conductores y trabajadores freelance.
            </p>
            <p>
              Los miembros se unen a un grupo y aportan un depósito semanal fijo (ej. <strong>$20.00/semana</strong>). Cada semana, un miembro según la rotación programada recibe el fondo colectivo acumulado (ej. <strong>$400.00 bruto / $360.00 neto</strong> para un grupo de 20 miembros). Al finalizar el ciclo de 20 semanas, cada miembro ha recibido un pago completo.
            </p>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
              💡 <strong>Ventaja Clave:</strong> 0% de interés, 0 comisiones abusivas y sin deudas bancarias. Ahorras junto a compañeros verificados y obtienes capital para reparaciones del vehículo, reserva de impuestos o fondos de emergencia.
            </div>
          </div>
        )
      },
      {
        id: 'faq_loan_difference',
        category: 'BASICS',
        question: '¿Es MutualPool un préstamo, tarjeta de crédito o banco?',
        tags: ['prestamo', 'credito', 'interes', 'banco', 'deuda', 'score', 'verificacion crediticia'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>¡No! MutualPool no es un prestamista ni una compañía de tarjetas de crédito.</strong> Tiene <strong>0% de interés</strong>, cero acumulación de deudas y no exige puntaje crediticio mínimo.
            </p>
            <p>
              En lugar de recurrir a préstamos de día de pago con intereses abusivos, ahorras tus propios ingresos con compañeros verificados de la comunidad. Cada dólar aportado proviene directamente de tus ingresos o saldo en Stripe Treasury.
            </p>
          </div>
        )
      },
      {
        id: 'faq_trusted_vs_open',
        category: 'BASICS',
        question: '¿Cuál es la diferencia entre un "Círculo de Confianza" y un "Grupo Abierto"?',
        tags: ['circulo de confianza', 'grupo abierto', 'privado', 'publico', 'invitacion', 'elegibilidad'],
        answer: (
          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1">
                <strong className="text-blue-950 font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-blue-700" />
                  Círculo de Confianza (Privado)
                </strong>
                <p className="text-blue-900">
                  Creado por ti para personas que conoces (familia, amigos, compañeros de reparto de tu zona). Accesible únicamente mediante enlace privado o código de invitación. Ideal para equipos de trabajo cercanos.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 space-y-1">
                <strong className="text-slate-950 font-bold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-700" />
                  Grupo Abierto (Público)
                </strong>
                <p className="text-slate-800">
                  Abierto a cualquier miembro verificado de MutualPool. Para crear un Grupo Abierto, el creador debe haber completado al menos 1 ciclo completo con un historial de pagos 100% puntual.
                </p>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'faq_creator_skin_in_game',
        category: 'CREATOR_REWARDS',
        question: '¿Por qué el Creador del Grupo se sitúa en el último turno de la rotación (Skin-in-the-Game)?',
        tags: ['creador', 'compromiso', 'ultimo turno', 'seguridad', 'proteccion', 'skin in the game'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Para prevenir fraudes y proteger a todos los miembros participantes, MutualPool aplica una garantía arquitectónica de <strong>"Compromiso Directo (Skin-in-the-Game)"</strong>:
            </p>
            <p>
              En grupos tradicionales sin supervisión, personas malintencionadas podían crear un grupo, asignarse el Turno #1 para cobrar primero y luego desaparecer sin completar los pagos restantes. Al <strong>fijar al Creador en el último turno (Turno #N)</strong>, el Creador asume un compromiso directo y garantiza que todos los ciclos semanales concluyan con éxito.
            </p>
            <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-950 font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
              <span>¡A cambio de ocupar el último lugar, los Creadores reciben la <strong>Recompensa de Anfitrión del 3%</strong>!</span>
            </div>
          </div>
        )
      },
      {
        id: 'faq_creator_host_reward',
        category: 'CREATOR_REWARDS',
        question: '¿Cómo funciona la Recompensa de Anfitrión del 3% para el Creador?',
        tags: ['recompensa anfitrion', 'tarifa creador', '3%', '10%', 'tarifa cobro', 'ingresos pasivos', 'compensacion'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Como compensación por coordinar el grupo y esperar hasta el último turno de cobro, los Creadores activos ganan una <strong>Recompensa de Anfitrión del 3%</strong> en cada pago realizado a sus compañeros (desembolsado a partir de la Tarifa de Servicio de Pago del 10%).
            </p>
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1.5 font-mono text-[11px]">
              <div className="font-bold text-emerald-950 font-sans">Ejemplo en un Grupo de 20 Miembros ($20/sem, Fondo $400):</div>
              <div className="flex justify-between text-slate-700">
                <span>Fondo Colectivo Bruto:</span>
                <span className="font-bold">$400.00</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Pago Neto al Beneficiario (90%):</span>
                <span className="font-bold text-emerald-700">$360.00</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Tarifa Total de Servicio (10%):</span>
                <span>-$40.00</span>
              </div>
              <div className="pt-1.5 border-t border-emerald-200 flex justify-between text-emerald-900 font-bold">
                <span>🎉 Recompensa del Creador (3%):</span>
                <span>+$12.00 / cobro</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[10px]">
                <span>🏛️ Tesorería y Reservas (7%):</span>
                <span>$28.00 / cobro</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              ¡A lo largo de 19 cobros de compañeros, el Creador gana <strong>$228.00 acumulados</strong> acreditados directamente en su saldo Stripe Treasury!
            </p>
          </div>
        )
      },
      {
        id: 'faq_invite_expiration_flexible',
        category: 'CREATOR_REWARDS',
        question: '¿Qué ocurre si un grupo no se llena antes de que expire la ventana de invitación?',
        tags: ['ventana invitacion', 'expiracion', 'lanzamiento flexible', 'comenzar temprano', 'capacidad', 'abrir publico'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Al crear un grupo, el Creador selecciona una <strong>Ventana de Invitación</strong> (3, 7, 14 o 30 días) y una acción de expiración:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li><strong>Abrir Automáticamente al Público:</strong> Las vacantes restantes se abren automáticamente para miembros con KYC verificado en la red MutualPool.</li>
              <li><strong>Seguir Esperando:</strong> El círculo permanece estrictamente privado mientras envías más invitaciones directas.</li>
            </ul>
            <p>
              Además, con el <strong>Lanzamiento Temprano Flexible</strong>, el Creador puede fijar la rotación e iniciar los ciclos tan pronto se unan <strong>2 o más miembros</strong>, sin esperar a los 20 cupos. Los cobros semanales se adaptan dinámicamente al número de miembros activos.
            </p>
          </div>
        )
      },
      {
        id: 'faq_deposits_collection',
        category: 'DEPOSITS_PAYOUTS',
        question: '¿Cómo se cobran los depósitos semanales?',
        tags: ['deposito', 'pago', 'debito directo', 'stripe treasury', 'automatico', 'banco'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Los depósitos se cobran automáticamente cada semana en la fecha de corte programada. Puedes fondear tus aportes mediante:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Saldo en tu Cuenta Stripe Treasury:</strong> Fondos disponibles en tu billetera verificada de MutualPool.</li>
              <li><strong>Cuenta Bancaria Vinculada (Débito Directo ACH):</strong> Respaldado por Plaid / Stripe Financial Connections.</li>
              <li><strong>Ganancias Diarias de Campañas de Marca:</strong> Los ingresos obtenidos en turnos verificados de entrega pueden compensar automáticamente tus aportes semanales.</li>
            </ol>
          </div>
        )
      },
      {
        id: 'faq_payout_fee_explained',
        category: 'DEPOSITS_PAYOUTS',
        question: '¿Cuáles son las tarifas de la plataforma y a dónde se destina el dinero?',
        tags: ['tarifas', '5%', '10%', 'tarifa servicio', 'costo', 'tesoreria', 'comisiones'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool aplica tarifas de servicio simples y transparentes, sin ningún interés compuesto oculto:
            </p>
            <ul className="space-y-2 text-[11px]">
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Tarifa de Depósito Inicial (5%):</strong> Se aplica únicamente al depósito inicial al crear o unirse a un grupo para inicializar tu cuenta financiera Stripe Treasury con seguro FDIC.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Tarifa de Servicio de Pago (10%):</strong> Se deduce cuando se entrega el pago acumulado al beneficiario del turno (ej. $40 en un fondo de $400 $\rightarrow$ $360 de pago neto).
                <div className="mt-1 text-[10px] text-slate-600">
                  • <strong>3%</strong> se abona al Creador del Grupo como Recompensa de Anfitrión.<br />
                  • <strong>7%</strong> financia la operación de tesorería, la Reserva de Contingencia del Primer Ciclo y el cumplimiento normativo FDIC.
                </div>
              </li>
            </ul>
          </div>
        )
      },
      {
        id: 'faq_payout_execution',
        category: 'DEPOSITS_PAYOUTS',
        question: '¿Cómo y cuándo recibo mi pago acumulado?',
        tags: ['cobro', 'retiro', 'transferencia', 'turno', 'calendario', 'desembolso'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Cuando llega tu semana programada en la rotación, el monto neto completo (ej. <strong>$360.00</strong>) se transfiere de inmediato a tu <strong>Cuenta Financiera Stripe Treasury</strong>.
            </p>
            <p>
              Una vez depositado en Treasury:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li>Puedes retirarlo inmediatamente a tu banco externo vinculado mediante Stripe OutboundTransfer.</li>
              <li>Puedes mantener el saldo en Treasury para cubrir futuros aportes u obtener rendimientos.</li>
              <li><strong>Las semanas de rotación siguientes nunca se detienen ni se bloquean por retiros bancarios pendientes.</strong></li>
            </ul>
          </div>
        )
      },
      {
        id: 'faq_missed_deposit_default',
        category: 'AI_CUSTODIAN_ESCROW',
        question: '¿Qué ocurre si un miembro no realiza un depósito semanal o incurre en impago?',
        tags: ['pago retrasado', 'impago', 'colchon contingencia', 'welcome match', 'periodo gracia', 'reemplazo'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool cuenta con una red de seguridad multicapa para garantizar que los beneficiarios <strong>reciban el 100% de su cobro puntual</strong>:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
              <li><strong>Período de Gracia de 72 Horas:</strong> Los miembros reciben recordatorios automáticos para regularizar su depósito sin penalización.</li>
              <li><strong>Fondo de Contingencia del Primer Ciclo (Welcome Match):</strong> En el Ciclo 1, el Welcome Match financiado por la plataforma cubre el depósito faltante para no interrumpir la rotación.</li>
              <li><strong>Reemplazo del Miembro Moroso:</strong> Si un miembro no regulariza su saldo, su plaza se abre como sustitución urgente para otros miembros verificados.</li>
              <li><strong>Cuenta de Depósitos de Custodia (Escrow) del Sistema:</strong> La plataforma respalda automáticamente cualquier diferencia para que el pago semanal nunca se retrase.</li>
            </ol>
          </div>
        )
      },
      {
        id: 'faq_autonomous_custodian',
        category: 'AI_CUSTODIAN_ESCROW',
        question: '¿Qué es el Protocolo de Custodia Autónoma por IA (Lainie AI)?',
        tags: ['lainie', 'custodia ia', 'autonomo', 'creador impago', 'sin carga'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Si un Creador experimenta dificultades, falta a sus pagos o incurre en mora, en lugar de trasladar el estrés administrativo o cobros a los demás miembros, la plataforma activa el <strong>Protocolo de Custodia Autónoma por IA</strong>:
            </p>
            <div className="p-3 bg-purple-900 text-white rounded-xl space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 font-bold text-purple-200 text-xs">
                <Bot className="w-4 h-4 text-purple-300" />
                <span>🤖 Lainie AI Asume la Custodia del Grupo</span>
              </div>
              <p className="text-purple-200/90">
                Lainie gestiona todas las operaciones, el bloqueo de turnos y los cobros semanales automáticos con <strong>cero carga administrativa para los miembros</strong>.
              </p>
              <p className="text-purple-200/80 text-[10px]">
                • El Creador pierde su Recompensa del 3%.<br />
                • La totalidad de la Tarifa de Servicio del 10% se redirige a la <strong>Cuenta de Escrow del Sistema</strong> para respaldar futuros pagos.
              </p>
            </div>
          </div>
        )
      },
      {
        id: 'faq_system_escrow',
        category: 'AI_CUSTODIAN_ESCROW',
        question: '¿Qué es la Cuenta de Depósitos de Custodia (Escrow) del Sistema?',
        tags: ['escrow sistema', 'liquidez', 'adelanto', 'reserva', 'garantia'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              La <strong>Cuenta de Depósitos de Custodia del Sistema</strong> es una reserva central de liquidez gestionada por MutualPool.
            </p>
            <p>
              Si un grupo tiene una vacante o un depósito no cobrado, el Escrow del Sistema adelanta el depósito semanal requerido (ej. <strong>$20.00</strong>) en nombre del grupo. Esto garantiza que los beneficiarios del turno reciban el 100% de su fondo programado sin esperar a que se incorporen nuevos miembros.
            </p>
          </div>
        )
      },
      {
        id: 'faq_hardship_relief',
        category: 'AI_CUSTODIAN_ESCROW',
        question: '¿Qué sucede si tengo dificultades personales o financieras durante un ciclo activo?',
        tags: ['dificultad', 'emergencia', 'pausa', 'accidente', 'medico', 'alivio'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Entendemos que el trabajo independiente puede ser impredecible debido a averías mecánicas, accidentes o emergencias médicas.
            </p>
            <p>
              Los miembros pueden enviar una <strong>Solicitud de Ayuda por Dificultad Financiera</strong> directamente desde la pantalla de su grupo. La plataforma puede otorgar un período de gracia extendido, activar la cobertura de contingencia o realizar una transición ordenada sin afectar tu reputación en la plataforma.
            </p>
          </div>
        )
      },
      {
        id: 'faq_fdic_insurance',
        category: 'SECURITY_FDIC',
        question: '¿Mis ahorros y saldos de grupos cuentan con seguro FDIC?',
        tags: ['fdic', 'seguro', 'stripe treasury', '$250,000', 'proteccion bancaria', 'seguridad'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>¡Sí!</strong> Todos los fondos y cuentas de custodia de MutualPool se alojan en <strong>Cuentas Financieras de Stripe Treasury</strong> respaldadas por instituciones bancarias miembros de la FDIC (como Evolve Bank & Trust o Fifth Third Bank, N.A.).
            </p>
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Los depósitos califican para <strong>seguro indirecto (pass-through) de la FDIC de hasta $250,000 por miembro</strong> frente a quiebras bancarias.</span>
            </div>
          </div>
        )
      },
      {
        id: 'faq_kyc_verification',
        category: 'SECURITY_FDIC',
        question: '¿Por qué debo completar la verificación de identidad (KYC) de Stripe?',
        tags: ['kyc', 'identidad', 'stripe identity', 'verificacion', 'cumplimiento', 'seguridad'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Conforme a las regulaciones bancarias federales (Ley de Secreto Bancario / Prevención de Lavado de Dinero) y las políticas de Stripe Treasury, la verificación de identidad es un requisito legal para abrir cuentas financieras.
            </p>
            <p>
              La verificación también protege a nuestra comunidad al garantizar que cada participante sea una persona real y autenticada, protegiendo a todos contra fraudes y cuentas duplicadas.
            </p>
          </div>
        )
      },
      {
        id: 'faq_slot_swap',
        category: 'SECURITY_FDIC',
        question: '¿Puedo intercambiar mi turno de cobro en caso de una emergencia?',
        tags: ['intercambio', 'cambio turno', 'emergencia', 'orden rotacion', 'swap'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>¡Sí!</strong> Si necesitas adelantar tu cobro por un imprevisto (como cambio de neumáticos o reparación mecánica), puedes enviar una <strong>Solicitud de Intercambio de Turno</strong> a otro compañero de tu grupo.
            </p>
            <p>
              En cuanto el otro miembro acepte la solicitud en su aplicación, las posiciones de cobro se intercambian automáticamente sin trámites manuales.
            </p>
          </div>
        )
      },
      {
        id: 'faq_ad_campaigns_apparel',
        category: 'AD_CAMPAIGNS',
        question: '¿Cómo funcionan las Campañas de Patrocinio de Marcas Asociadas?',
        tags: ['marca', 'campana', 'patrocinio', 'sudadera', 'mochila termica', 'ingresos diarios', 'ganancias extra'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool se asocia con marcas líderes para patrocinar a conductores y repartidores.
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Ropa y Equipamiento Gratuito:</strong> Los repartidores aprobados reciben sudaderas impermeables premium, bolsas térmicas aisladas y camisetas oficiales.</li>
              <li><strong>Pagos Diarios por Campaña:</strong> Los embajadores reciben pagos garantizados de forma diaria (de <strong>$55.00 a $75.00/día</strong>) por cada turno completado y verificado en las campañas seleccionadas en las que participan.</li>
              <li><strong>Abono Directo en Stripe Treasury:</strong> Los ingresos diarios se depositan directamente en tu cuenta Stripe Treasury tras la verificación del turno por IA Vision, listos para transferir a tu banco o usar en tus fondos.</li>
            </ul>
          </div>
        )
      },
      {
        id: 'faq_gear_vision_verification',
        category: 'AD_CAMPAIGNS',
        question: '¿Cómo se verifican los turnos de marca y el equipamiento del repartidor?',
        tags: ['vision', 'ia verificacion', 'gps', 'checkin turno', 'foto', 'prueba'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Los repartidores simplemente se toman una selfie vistiendo su indumentaria de patrocinador al inicio de su ruta de entrega.
            </p>
            <p>
              Nuestro motor de <strong>IA Visual multimodal</strong> verifica que el equipamiento se use correctamente, mientras el GPS registra el kilometraje de la ruta activa durante las horas de la campaña. Una vez verificado, los ingresos diarios se liberan instantáneamente a tu billetera Stripe Treasury.
            </p>
          </div>
        )
      }
    ];
  }

  if (lang === 'fr') {
    return [
      {
        id: 'faq_rosca_basics',
        category: 'BASICS',
        question: 'Qu\'est-ce que MutualPool et comment fonctionne un Groupe d\'Épargne Mutuelle ?',
        tags: ['rosca', 'tanda', 'susu', 'ajo', 'pardna', 'arisan', 'chit fund', 'tontine', 'bases', 'rotation', 'versement', 'epargne'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>MutualPool</strong> est une Association d'Épargne et de Crédit Rotatif (tontine / ROSCA) modernisée entre pairs—connue culturellement dans le monde entier sous le nom de <em>tanda, susu, ajo, pardna, arisan ou chit fund</em>—spécialement conçue pour les livreurs indépendants, coursiers et travailleurs autonomes de la gig economy.
            </p>
            <p>
              Les membres rejoignent un groupe et versent une contribution hebdomadaire fixe (ex. <strong>20,00 $/semaine</strong>). Chaque semaine, un membre selon le calendrier de rotation reçoit la cagnotte collective complète (ex. <strong>400,00 $ brut / 360,00 $ net</strong> pour un groupe de 20 membres). À la fin du cycle de 20 semaines, chaque membre a reçu un versement forfaitaire complet.
            </p>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
              💡 <strong>Avantage Clé :</strong> 0 % d'intérêt, aucun frais d'usure et aucun endettement bancaire. Vous épargnez solidairement avec des pairs vérifiés pour financer l'entretien de votre véhicule, vos impôts ou une épargne de précaution.
            </div>
          </div>
        )
      },
      {
        id: 'faq_loan_difference',
        category: 'BASICS',
        question: 'MutualPool est-il un prêt, une carte de crédit ou une banque ?',
        tags: ['pret', 'credit', 'interet', 'banque', 'dette', 'score', 'endettement'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>Non ! MutualPool n'est ni un prêteur ni une société de carte de crédit.</strong> Il n'y a <strong>aucun intérêt</strong>, aucune dette cumulée et aucune exigence de score de crédit.
            </p>
            <p>
              Plutôt que d'emprunter auprès d'organismes de crédit à taux usuraires, vous mutualisez vos propres revenus avec des pairs vérifiés de votre communauté. Chaque dollar versé provient directement de vos revenus ou de votre solde Stripe Treasury.
            </p>
          </div>
        )
      },
      {
        id: 'faq_trusted_vs_open',
        category: 'BASICS',
        question: 'Quelle est la différence entre un « Cercle de Confiance » et un « Groupe Ouvert » ?',
        tags: ['cercle de confiance', 'groupe ouvert', 'prive', 'public', 'invitation', 'eligibilite'],
        answer: (
          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1">
                <strong className="text-blue-950 font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-blue-700" />
                  Cercle de Confiance (Privé)
                </strong>
                <p className="text-blue-900">
                  Créé par vous pour vos proches (famille, amis, collègues de tournée de livraison). Accessible uniquement via un lien privé ou un code d'invitation. Idéal pour les équipes de travail soudées.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 space-y-1">
                <strong className="text-slate-950 font-bold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-700" />
                  Groupe Ouvert (Public)
                </strong>
                <p className="text-slate-800">
                  Ouvert à tout membre vérifié de MutualPool. Pour créer un Groupe Ouvert, le créateur doit avoir complété au moins 1 cycle complet avec 100 % de paiements ponctuels.
                </p>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'faq_creator_skin_in_game',
        category: 'CREATOR_REWARDS',
        question: 'Pourquoi le Créateur du Groupe est-il placé sur le dernier créneau de rotation (Skin-in-the-Game) ?',
        tags: ['createur', 'engagement', 'dernier tour', 'securite', 'protection defaut', 'skin in the game'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Pour prévenir la fraude et protéger l'ensemble des membres, MutualPool applique une garantie d'engagement direct <strong>(« Skin-in-the-Game »)</strong> :
            </p>
            <p>
              Dans les tontines informelles traditionnelles, des personnes malintentionnées pouvaient créer un groupe, prendre le Tour n°1 pour encaisser la cagnotte puis disparaître sans honorer leurs cotisations futures. En <strong>attribuant obligatoirement le dernier créneau (Tour n°N) au Créateur</strong>, celui-ci s'engage directement et veille au parfait déroulement de chaque cycle hebdomadaire.
            </p>
            <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-950 font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
              <span>En contrepartie de cette position finale, le Créateur reçoit la <strong>Prime de Gouvernance Hôte de 3 %</strong> !</span>
            </div>
          </div>
        )
      },
      {
        id: 'faq_creator_host_reward',
        category: 'CREATOR_REWARDS',
        question: 'Comment fonctionne la Prime de Gouvernance Hôte de 3 % pour le Créateur ?',
        tags: ['prime hote', 'frais createur', '3%', '10%', 'frais versement', 'revenus passifs', 'remuneration'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              En contrepartie de la création, de l'animation du groupe et de l'attente du dernier tour, les Créateurs de groupe actifs perçoivent une <strong>Prime de Gouvernance Hôte de 3 %</strong> sur chaque versement attribué aux membres (déduite des 10 % de Frais de Service de Versement).
            </p>
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1.5 font-mono text-[11px]">
              <div className="font-bold text-emerald-950 font-sans">Exemple sur un Groupe de 20 Membres (20 $/sem, Cagnotte de 400 $) :</div>
              <div className="flex justify-between text-slate-700">
                <span>Cagnotte Collective Brute :</span>
                <span className="font-bold">400,00 $</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Versement Net au Bénéficiaire (90 %) :</span>
                <span className="font-bold text-emerald-700">360,00 $</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Frais de Service Globaux (10 %) :</span>
                <span>-40,00 $</span>
              </div>
              <div className="pt-1.5 border-t border-emerald-200 flex justify-between text-emerald-900 font-bold">
                <span>🎉 Prime Créateur Hôte (3 %) :</span>
                <span>+12,00 $ / versement</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[10px]">
                <span>🏛️ Trésorerie & Réserves (7 %) :</span>
                <span>28,00 $ / versement</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              Sur 19 versements de coéquipiers, le Créateur accumule <strong>228,00 $ de primes</strong> versées directement sur son compte Stripe Treasury !
            </p>
          </div>
        )
      },
      {
        id: 'faq_invite_expiration_flexible',
        category: 'CREATOR_REWARDS',
        question: 'Que se passe-t-il si un groupe n\'est pas complet avant l\'expiration du délai d\'invitation ?',
        tags: ['delai invitation', 'expiration', 'lancement flexible', 'demarrage anticipe', 'capacite', 'ouverture publique'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Lors de la création d'un groupe, le Créateur choisit une <strong>Période d'Invitation</strong> (3, 7, 14 ou 30 jours) et une action d'expiration :
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li><strong>Ouverture Automatique au Public :</strong> Les places vacantes s'ouvrent automatiquement aux membres vérifiés par KYC du réseau MutualPool.</li>
              <li><strong>Poursuivre l'Attente :</strong> Le cercle reste strictement privé pendant que vous envoyez d'autres invitations directes.</li>
            </ul>
            <p>
              De plus, grâce au <strong>Lancement Anticipé Flexible</strong>, le Créateur peut verrouiller la rotation et démarrer les cycles dès que <strong>2 membres ou plus</strong> ont rejoint le groupe, sans devoir attendre les 20 places. Les versements hebdomadaires s'ajustent automatiquement au nombre de membres actifs.
            </p>
          </div>
        )
      },
      {
        id: 'faq_deposits_collection',
        category: 'DEPOSITS_PAYOUTS',
        question: 'Comment les cotisations hebdomadaires sont-elles prélevées ?',
        tags: ['depot', 'paiement', 'prelevement automatique', 'stripe treasury', 'automatique', 'banque'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Les dépôts sont prélevés automatiquement chaque semaine à la date d'échéance programmée. Vous pouvez approvisionner vos cotisations via :
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Solde du Compte Stripe Treasury :</strong> Fonds disponibles dans votre portefeuille MutualPool vérifié.</li>
              <li><strong>Compte Bancaire Lié (Prélèvement Automatique ACH) :</strong> Sécurisé par Plaid / Stripe Financial Connections.</li>
              <li><strong>Revenus Quotidiens de Campagnes de Marque :</strong> Les gains quotidiens issus de vos tournées sponsorisées peuvent compenser automatiquement vos cotisations de groupe.</li>
            </ol>
          </div>
        )
      },
      {
        id: 'faq_payout_fee_explained',
        category: 'DEPOSITS_PAYOUTS',
        question: 'Quels sont les frais de plateforme et à quoi servent-ils ?',
        tags: ['frais', '5%', '10%', 'frais service', 'cout', 'tresorerie', 'commissions'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool applique des frais de service simples et transparents, sans aucun intérêt composé :
            </p>
            <ul className="space-y-2 text-[11px]">
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Frais de Dépôt Initial (5 %) :</strong> Appliqués uniquement lors de votre premier versement lors de la création ou de l'adhésion à un groupe pour initialiser votre compte financier Stripe Treasury garanti FDIC.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Frais de Service de Versement (10 %) :</strong> Déduits lors du versement de la cagnotte au bénéficiaire du tour (ex. 40 $ sur une cagnotte de 400 $ $\rightarrow$ 360 $ net versés).
                <div className="mt-1 text-[10px] text-slate-600">
                  • <strong>3 %</strong> sont versés au Créateur du Groupe sous forme de Prime de Gouvernance Hôte.<br />
                  • <strong>7 %</strong> financent les opérations de trésorerie, le Fonds de Réserve du Premier Cycle et la conformité FDIC.
                </div>
              </li>
            </ul>
          </div>
        )
      },
      {
        id: 'faq_payout_execution',
        category: 'DEPOSITS_PAYOUTS',
        question: 'Comment et quand vais-je recevoir mon versement forfaitaire ?',
        tags: ['versement', 'retrait', 'virement', 'tour', 'calendrier', 'paiement'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Dès que votre semaine de rotation programmée arrive, la somme forfaitaire nette (ex. <strong>360,00 $</strong>) est transférée instantanément sur votre <strong>Compte Financier Stripe Treasury</strong>.
            </p>
            <p>
              Une fois sur votre compte Treasury :
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li>Vous pouvez transférer les fonds immédiatement vers votre compte bancaire externe via Stripe OutboundTransfer.</li>
              <li>Vous pouvez conserver le solde dans Treasury pour couvrir automatiquement vos futurs versements ou générer des intérêts.</li>
              <li><strong>Les rotations des semaines suivantes ne sont jamais interrompues ni bloquées par des délais de virement bancaire externe.</strong></li>
            </ul>
          </div>
        )
      },
      {
        id: 'faq_missed_deposit_default',
        category: 'AI_CUSTODIAN_ESCROW',
        question: 'Que se passe-t-il si un membre manque un dépôt hebdomadaire ou est en défaut de paiement ?',
        tags: ['impaye', 'defaut', 'tampon continuite', 'welcome match', 'periode grace', 'remplacement'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool dispose d'un filet de sécurité multi-niveaux garantissant que les bénéficiaires <strong>reçoivent toujours 100 % de leur versement à temps</strong> :
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
              <li><strong>Période de Grâce de 72 Heures :</strong> Les membres reçoivent des rappels automatisés pour régulariser leur dépôt sans pénalité.</li>
              <li><strong>Tampon de Continuité Premier Cycle (Welcome Match) :</strong> Au Cycle 1, le Welcome Match financé par la plateforme couvre le dépôt manquant pour ne pas interrompre la rotation.</li>
              <li><strong>Remplacement du Membre Défaillant :</strong> Si un membre ne régularise pas sa situation, sa place est ouverte en remplacement urgent pour d'autres membres vérifiés.</li>
              <li><strong>Compte d'Entiercement Système (Escrow) :</strong> La plateforme compense automatiquement tout écart afin que le versement hebdomadaire ne subisse aucun retard.</li>
            </ol>
          </div>
        )
      },
      {
        id: 'faq_autonomous_custodian',
        category: 'AI_CUSTODIAN_ESCROW',
        question: 'Qu\'est-ce que le Protocole de Gardienne IA Autonome (Lainie AI) ?',
        tags: ['lainie', 'gardienne ia', 'autonome', 'defaut createur', 'zero charge'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Si le Créateur d'un groupe traverse une difficulté, manque ses cotisations ou fait défaut, plutôt que d'imposer un stress administratif ou un recouvrement aux autres membres, la plateforme déclenche le <strong>Protocole de Gardienne IA Autonome</strong> :
            </p>
            <div className="p-3 bg-purple-900 text-white rounded-xl space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 font-bold text-purple-200 text-xs">
                <Bot className="w-4 h-4 text-purple-300" />
                <span>🤖 Lainie AI Prend la Tutelle du Groupe</span>
              </div>
              <p className="text-purple-200/90">
                Lainie prend en charge la gestion complète du groupe, le verrouillage de la rotation et l'exécution automatisée des versements avec <strong>zéro charge administrative pour les membres</strong>.
              </p>
              <p className="text-purple-200/80 text-[10px]">
                • Le Créateur perd sa Prime de 3 %.<br />
                • L'intégralité des 10 % de Frais de Service est réaffectée au <strong>Compte d'Entiercement Système</strong> pour garantir les versements futurs.
              </p>
            </div>
          </div>
        )
      },
      {
        id: 'faq_system_escrow',
        category: 'AI_CUSTODIAN_ESCROW',
        question: 'Qu\'est-ce que le Compte d\'Entiercement Système (Escrow) ?',
        tags: ['entiercement systeme', 'liquidite', 'avance', 'reserve', 'garantie'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Le <strong>Compte d'Entiercement Système</strong> est une réserve centrale de liquidité gérée par MutualPool.
            </p>
            <p>
              Si un groupe comporte une place vacante ou une cotisation non perçue, l'Entiercement Système avance le dépôt hebdomadaire requis (ex. <strong>20,00 $</strong>) au nom du groupe. Cela garantit que les membres perçoivent 100 % de leur cagnotte programmée sans devoir attendre l'arrivée d'un remplaçant.
            </p>
          </div>
        )
      },
      {
        id: 'faq_hardship_relief',
        category: 'AI_CUSTODIAN_ESCROW',
        question: 'Que se passe-t-il si je rencontre une difficulté personnelle ou financière durant un cycle actif ?',
        tags: ['difficulte', 'urgence', 'pause', 'accident', 'medical', 'aide'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Nous savons que le travail indépendant comporte des imprévus tels que des pannes de véhicule, des accidents ou des urgences médicales.
            </p>
            <p>
              Les membres peuvent soumettre une <strong>Demande d'Aide pour Coup Dur</strong> directement depuis l'écran de leur groupe. La plateforme peut accorder un délai de grâce prolongé, activer le fonds de solidarité ou réorganiser le groupe en toute sérénité sans pénaliser votre profil.
            </p>
          </div>
        )
      },
      {
        id: 'faq_fdic_insurance',
        category: 'SECURITY_FDIC',
        question: 'Mes économies et les soldes de mes groupes sont-ils assurés par la FDIC ?',
        tags: ['fdic', 'assurance', 'stripe treasury', '250000', 'protection bancaire', 'securite'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>Oui !</strong> Tous les fonds et comptes de séquestre de MutualPool sont hébergés sur des <strong>Comptes Financiers Stripe Treasury</strong> adossés à des banques membres de la FDIC (telles qu'Evolve Bank & Trust ou Fifth Third Bank, N.A.).
            </p>
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Les dépôts sont couverts par une <strong>assurance indirecte (pass-through) de la FDIC jusqu'à 250 000 $ par membre</strong> en cas de faillite bancaire.</span>
            </div>
          </div>
        )
      },
      {
        id: 'faq_kyc_verification',
        category: 'SECURITY_FDIC',
        question: 'Pourquoi dois-je effectuer la vérification d\'identité Stripe (KYC) ?',
        tags: ['kyc', 'identite', 'stripe identity', 'verification', 'conformite', 'securite'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Conformément aux réglementations bancaires fédérales (loi sur le secret bancaire / lutte contre le blanchiment d'argent) et aux exigences de Stripe Treasury, la vérification d'identité est obligatoire pour ouvrir des comptes financiers.
            </p>
            <p>
              Cette vérification protège également l'ensemble de notre communauté en s'assurant que chaque participant est une personne authentique et certifiée, évitant ainsi les fraudes et faux profils.
            </p>
          </div>
        )
      },
      {
        id: 'faq_slot_swap',
        category: 'SECURITY_FDIC',
        question: 'Puis-je échanger ma place dans la rotation en cas d\'urgence ?',
        tags: ['echange', 'creneau', 'urgence', 'ordre rotation', 'swap'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>Oui !</strong> Si vous avez besoin d'encaisser votre cagnotte plus tôt pour faire face à une dépense imprévue (changement de pneus, réparation mécanique), vous pouvez envoyer une <strong>Demande d'Échange de Créneau</strong> à un autre membre de votre groupe.
            </p>
            <p>
              Dès que ce dernier accepte la demande dans son application, vos rangs s'échangent instantanément et sans aucune démarche administrative fastidieuse.
            </p>
          </div>
        )
      },
      {
        id: 'faq_ad_campaigns_apparel',
        category: 'AD_CAMPAIGNS',
        question: 'Comment fonctionnent les Campagnes de Sponsoring de Marques Partenaires ?',
        tags: ['marque', 'campagne', 'sponsoring', 'sweat', 'sac isotherme', 'remuneration quotidienne', 'revenus extra'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool s'associe à des marques de renom pour sponsoriser les livreurs et coursiers indépendants.
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Équipement Sponsor Gratuit :</strong> Les coursiers sélectionnés reçoivent des sweats imperméables haut de gamme, des sacs de livraison isothermes et des t-shirts officiels.</li>
              <li><strong>Rémunération Quotidienne par Campagne :</strong> Les ambassadeurs sont rémunérés sur une base quotidienne (de <strong>55,00 $ à 75,00 $/jour</strong>) pour chaque tournée validée dans les campagnes sélectionnées auxquelles ils participent.</li>
              <li><strong>Versement Direct sur Stripe Treasury :</strong> Vos gains quotidiens sont instantanément crédités sur votre compte Stripe Treasury dès la validation de votre tournée par IA Vision, prêts pour un virement bancaire ou pour alimenter vos cotisations d'épargne.</li>
            </ul>
          </div>
        )
      },
      {
        id: 'faq_gear_vision_verification',
        category: 'AD_CAMPAIGNS',
        question: 'Comment les tournées sponsorisées et l\'équipement sont-ils vérifiés ?',
        tags: ['vision', 'ia verification', 'gps', 'checkin tournee', 'photo', 'preuve'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Les coursiers prennent simplement un selfie avec leur équipement de sponsor au début de leur tournée de livraison.
            </p>
            <p>
              Notre moteur de <strong>Vision IA multimodal</strong> vérifie le port de l'équipement, tandis que le GPS enregistre le kilométrage actif pendant les heures de campagne. Une fois validé, votre rémunération quotidienne est créditée immédiatement sur votre compte Stripe Treasury.
            </p>
          </div>
        )
      }
    ];
  }

  // Default: English
  return [
    {
      id: 'faq_rosca_basics',
      category: 'BASICS',
      question: 'What is MutualPool and how does a Mutual Savings Pod work?',
      tags: ['rosca', 'tanda', 'susu', 'ajo', 'pardna', 'arisan', 'chit fund', 'basics', 'rotation', 'payout', 'pool'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>MutualPool</strong> is a modernized peer-to-peer <strong>Rotating Savings and Credit Association (ROSCA)</strong>—known culturally worldwide as a <em>tanda, susu, ajo, pardna, arisan, or chit fund</em>—built specifically for independent delivery drivers, couriers, and freelance gig workers.
          </p>
          <p>
            Members join a pod and contribute a fixed weekly deposit (e.g., <strong>$20.00/week</strong>). Each week, one member in the scheduled rotation receives the entire collective lump-sum pot (e.g., <strong>$400.00 gross / $360.00 net</strong> for a 20-member pod). By the end of the 20-week cycle, every single member has received one full lump-sum payout.
          </p>
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
            💡 <strong>Key Advantage:</strong> 0% interest, 0 predatory compounding fees, and no bank loan debt. You save together with verified peers and unlock lump-sum capital for vehicle repairs, tax reserves, or emergency savings.
          </div>
        </div>
      )
    },
    {
      id: 'faq_loan_difference',
      category: 'BASICS',
      question: 'Is MutualPool a loan, credit card, or bank?',
      tags: ['loan', 'credit', 'interest', 'bank', 'debt', 'score', 'credit check'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>No! MutualPool is neither a lender nor a credit card company.</strong> There is <strong>zero interest</strong>, no compounding debt, and no minimum credit score requirement.
          </p>
          <p>
            Instead of borrowing from a predatory payday lender, you are pooling your own hard-earned income with verified community peers. Every dollar paid into the rotation comes directly from your earnings or Stripe Treasury balance.
          </p>
        </div>
      )
    },
    {
      id: 'faq_trusted_vs_open',
      category: 'BASICS',
      question: 'What is the difference between a "Trusted Circle" and an "Open Pod"?',
      tags: ['trusted circle', 'open pod', 'private', 'public', 'invitation', 'eligibility'],
      answer: (
        <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1">
              <strong className="text-blue-950 font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-700" />
                Trusted Circle (Private)
              </strong>
              <p className="text-blue-900">
                Created by you for people you know (family, friends, regional delivery hub coworkers). Accessible only via private link or invite code. Perfect for close-knit gig crews.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 space-y-1">
              <strong className="text-slate-950 font-bold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-700" />
                Open Pod (Public)
              </strong>
              <p className="text-slate-800">
                Open to any verified MutualPool member. To create an Open Pod, creators must have completed at least 1 full cycle with 100% on-time deposit history.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'faq_creator_skin_in_game',
      category: 'CREATOR_REWARDS',
      question: 'Why is the Pod Creator placed in the final rotation slot (Skin-in-the-Game)?',
      tags: ['creator', 'skin in the game', 'final slot', 'last turn', 'security', 'default protection'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            To prevent fraud and protect all participating members, MutualPool enforces an architectural <strong>"Skin-in-the-Game" Guarantee</strong>:
          </p>
          <p>
            In traditional unmonitored circles, bad actors might start a group, take Turn #1 to collect an early lump-sum payout, and then disappear without making subsequent weekly payments. By <strong>pinning the Creator to the final rotation slot (Turn #N)</strong>, the Creator has direct skin in the game and stays committed to ensuring all weekly cycles complete successfully.
          </p>
          <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-950 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
            <span>In exchange for taking the last slot, Creators receive the <strong>3% Host Stewardship Reward</strong>!</span>
          </div>
        </div>
      )
    },
    {
      id: 'faq_creator_host_reward',
      category: 'CREATOR_REWARDS',
      question: 'How does the 3% Creator Host Stewardship Reward work?',
      tags: ['host reward', 'creator fee', '3%', '10%', 'payout fee', 'passive earnings', 'compensation'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            As compensation for hosting the pod and waiting until the final rotation turn, active Pod Creators earn a <strong>3% Host Stewardship Reward</strong> on every teammate payout throughout the circle (disbursed out of the 10% Payout Service Fee).
          </p>
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1.5 font-mono text-[11px]">
            <div className="font-bold text-emerald-950 font-sans">Example on a 20-Member Pod ($20/wk, $400 Pool):</div>
            <div className="flex justify-between text-slate-700">
              <span>Gross Collective Pool:</span>
              <span className="font-bold">$400.00</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Recipient Net Payout (90%):</span>
              <span className="font-bold text-emerald-700">$360.00</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Total 10% Payout Service Fee:</span>
              <span>-$40.00</span>
            </div>
            <div className="pt-1.5 border-t border-emerald-200 flex justify-between text-emerald-900 font-bold">
              <span>🎉 Creator Host Reward (3%):</span>
              <span>+$12.00 / payout</span>
            </div>
            <div className="flex justify-between text-slate-600 text-[10px]">
              <span>🏛️ Platform Treasury & Reserves (7%):</span>
              <span>$28.00 / payout</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600">
            Over 19 teammate payouts, the Creator earns <strong>$228.00 in cumulative host rewards</strong> credited directly to their Stripe Treasury balance!
          </p>
        </div>
      )
    },
    {
      id: 'faq_invite_expiration_flexible',
      category: 'CREATOR_REWARDS',
      question: 'What happens if a pod does not fill up before the invite window expires?',
      tags: ['invite window', 'expiration', 'flexible launch', 'start early', 'capacity', 'auto open'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            When creating a pod, the Creator selects an <strong>Invite Window</strong> (3, 7, 14, or 30 days) and an expiration action:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
            <li><strong>Auto-Open to Public:</strong> Remaining vacant spots automatically open to KYC-verified members across the MutualPool network.</li>
            <li><strong>Keep Waiting:</strong> The circle remains strictly private while you send more direct invites.</li>
          </ul>
          <p>
            Additionally, with <strong>Flexible Early Launch</strong>, the Creator can lock the rotation and begin weekly payout cycles as soon as <strong>2 or more members</strong> have joined, without waiting for the full 20 slots. Weekly payouts dynamically scale to match the active member count.
          </p>
        </div>
      )
    },
    {
      id: 'faq_deposits_collection',
      category: 'DEPOSITS_PAYOUTS',
      question: 'How are weekly deposits collected?',
      tags: ['deposit', 'payment', 'direct debit', 'stripe treasury', 'automatic', 'bank'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Deposits are collected automatically each week on the scheduled cycle cutoff date. You can fund your deposits using:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li><strong>Stripe Treasury Account Balance:</strong> Funds available in your verified MutualPool Treasury wallet.</li>
            <li><strong>Linked Bank Account (ACH Direct Debit):</strong> Backed by Plaid / Stripe Financial Connections.</li>
            <li><strong>Brand Campaign Daily Courier Earnings:</strong> Daily wages earned from verified brand delivery shifts can automatically offset weekly pod contributions.</li>
          </ol>
        </div>
      )
    },
    {
      id: 'faq_payout_fee_explained',
      category: 'DEPOSITS_PAYOUTS',
      question: 'What are the platform fees and where does the money go?',
      tags: ['fees', '5%', '10%', 'service fee', 'cost', 'treasury', 'charges'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            MutualPool charges transparent, simple service fees with zero hidden compounding interest:
          </p>
          <ul className="space-y-2 text-[11px]">
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong>Initial Deposit Fee (5%):</strong> Applied only to your initial deposit when creating or joining a pod to initialize your FDIC-insured Stripe Treasury financial account.
            </li>
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong>Payout Service Fee (10%):</strong> Deducted when a lump-sum payout is disbursed to the rotation recipient (e.g., $40 on a $400 pool $\rightarrow$ $360 net payout).
              <div className="mt-1 text-[10px] text-slate-600">
                • <strong>3%</strong> is disbursed to the active Pod Creator as a Host Stewardship Reward.<br />
                • <strong>7%</strong> funds MutualPool Treasury operations, the First-Cycle Contingency Reserve, and FDIC compliance.
              </div>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq_payout_execution',
      category: 'DEPOSITS_PAYOUTS',
      question: 'How and when do I receive my lump-sum payout?',
      tags: ['payout', 'withdrawal', 'transfer', 'turn', 'schedule', 'earmarked'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            When your scheduled rotation week arrives, the full net lump-sum (e.g. <strong>$360.00</strong>) is instantly transferred directly into your <strong>Stripe Treasury Financial Account</strong>.
          </p>
          <p>
            Once deposited in Treasury:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
            <li>You can withdraw funds immediately to your linked external bank via Stripe OutboundTransfer.</li>
            <li>You can keep the balance in Treasury to automatically cover future pod deposits or earn interest.</li>
            <li><strong>Subsequent rotation weeks never wait, pause, or block for delayed withdrawals.</strong></li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq_missed_deposit_default',
      category: 'AI_CUSTODIAN_ESCROW',
      question: 'What happens if a member misses a weekly deposit or defaults?',
      tags: ['missed payment', 'default', 'contingency buffer', 'welcome match', 'grace period', 'replacement'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            MutualPool has a multi-layered safety net to ensure that weekly rotation recipients <strong>always receive their 100% full payout on time</strong>:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
            <li><strong>72-Hour Grace Period:</strong> Members receive automated reminders to clear overdue deposits without penalty.</li>
            <li><strong>First-Cycle Contingency Buffer (Welcome Match):</strong> In Cycle 1, MutualPool's platform-funded Welcome Match covers the missing deposit so the rotation is not interrupted.</li>
            <li><strong>Delinquent Member Replacement:</strong> If a member fails to resolve their balance, their spot is opened as an urgent replacement for verified members.</li>
            <li><strong>System Deposits Escrow Account:</strong> The platform automatically backstops any remaining shortfall so the weekly payout is never delayed.</li>
          </ol>
        </div>
      )
    },
    {
      id: 'faq_autonomous_custodian',
      category: 'AI_CUSTODIAN_ESCROW',
      question: 'What is the Autonomous AI Custodian Protocol (Lainie)?',
      tags: ['lainie', 'ai custodian', 'autonomous', 'stewardship', 'creator default', 'zero burden'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            If a Pod Creator experiences hardship, misses deposits, or defaults, rather than forcing administrative stress or debt collection onto other members, the platform triggers the <strong>Autonomous AI Custodian Protocol</strong>:
          </p>
          <div className="p-3 bg-purple-900 text-white rounded-xl space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2 font-bold text-purple-200 text-xs">
              <Bot className="w-4 h-4 text-purple-300" />
              <span>🤖 Lainie AI Assumes Pod Custodianship</span>
            </div>
            <p className="text-purple-200/90">
              Lainie takes over all pod operations, rotation locking, and automated weekly payouts with <strong>zero administrative burden on members</strong>.
            </p>
            <p className="text-purple-200/80 text-[10px]">
              • Creator forfeits their 3% Host Reward.<br />
              • The full 10% Payout Service Fee is redirected into the <strong>System Deposits Escrow Account</strong> to backstop future member payouts.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'faq_system_escrow',
      category: 'AI_CUSTODIAN_ESCROW',
      question: 'What is the System Deposits Escrow Account?',
      tags: ['system escrow', 'liquidity', 'advance', 'reserve', 'shortfall', 'guarantee'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            The <strong>System Deposits Escrow Account</strong> is a central platform liquidity reserve managed by MutualPool.
          </p>
          <p>
            If a pod has a vacant spot or an uncollected deposit, the System Escrow advances the required weekly deposit (e.g. <strong>$20.00</strong>) on behalf of the pod. This guarantees that rotation recipients receive 100% of their scheduled lump sum without waiting for replacement members to join.
          </p>
        </div>
      )
    },
    {
      id: 'faq_hardship_relief',
      category: 'AI_CUSTODIAN_ESCROW',
      question: 'What if I experience personal or financial hardship during an active cycle?',
      tags: ['hardship', 'emergency', 'pause', 'accident', 'medical', 'relief'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            We understand gig work can be unpredictable due to vehicle breakdowns, accidents, or medical emergencies.
          </p>
          <p>
            Members can submit a <strong>Financial Hardship Relief Request</strong> directly from their pod screen. The platform can grant an extended deposit grace period, activate contingency coverage, or gracefully transition the pod without damaging your platform standing.
          </p>
        </div>
      )
    },
    {
      id: 'faq_fdic_insurance',
      category: 'SECURITY_FDIC',
      question: 'Are my savings and pod balances FDIC insured?',
      tags: ['fdic', 'insurance', 'stripe treasury', '$250,000', 'bank protection', 'safety'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>Yes!</strong> All MutualPool funds and pod holding accounts reside in dedicated <strong>Stripe Treasury Financial Accounts</strong> backed by FDIC member institutions (such as Evolve Bank & Trust or Fifth Third Bank, N.A.).
          </p>
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Deposits qualify for <strong>pass-through FDIC insurance up to $250,000 per member</strong> against bank failure.</span>
          </div>
        </div>
      )
    },
    {
      id: 'faq_kyc_verification',
      category: 'SECURITY_FDIC',
      question: 'Why do I need to complete Stripe Identity (KYC) verification?',
      tags: ['kyc', 'identity', 'stripe identity', 'verification', 'compliance', 'security'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Under federal banking regulations (Bank Secrecy Act / Anti-Money Laundering) and Stripe Treasury policies, identity verification is legally required to establish financial holding accounts.
          </p>
          <p>
            Verification also safeguards our gig community by ensuring every pool participant is a real, authenticated individual—protecting everyone against fraud and duplicate accounts.
          </p>
        </div>
      )
    },
    {
      id: 'faq_slot_swap',
      category: 'SECURITY_FDIC',
      question: 'Can I swap my rotation payout spot if I have an emergency?',
      tags: ['swap', 'reprioritize', 'trade slot', 'emergency', 'rotation order', 'peer swap'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>Yes!</strong> If you need an earlier payout for an unexpected expense (such as a tire replacement or transmission repair), you can send a <strong>Peer Rotation Swap Request</strong> to another member in your pod.
          </p>
          <p>
            Once the other member accepts the swap request in their app, your rotation positions trade automatically with zero manual paperwork.
          </p>
        </div>
      )
    },
    {
      id: 'faq_ad_campaigns_apparel',
      category: 'AD_CAMPAIGNS',
      question: 'How do Brand Partner Sponsorship Campaigns work?',
      tags: ['brand', 'campaign', 'sponsor', 'hoodie', 'delivery bag', 'daily wage', 'extra earnings'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            MutualPool partners with leading lifestyle and beverage brands to sponsor gig couriers.
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li><strong>Free Sponsor Apparel:</strong> Approved couriers receive premium weatherproof hoodies, insulated delivery bags, and t-shirts.</li>
            <li><strong>Daily Payouts per Selected Campaign:</strong> Ambassadors are paid on a daily basis (typically <strong>$55.00 to $75.00/day</strong>) based on the specific campaigns they participate in and complete qualifying delivery shifts for.</li>
            <li><strong>Instant Stripe Treasury Payouts:</strong> Daily earnings are automatically credited to your Stripe Treasury wallet upon completing and verifying each shift with AI Vision.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq_gear_vision_verification',
      category: 'AD_CAMPAIGNS',
      question: 'How are courier brand shifts and gear verified?',
      tags: ['vision', 'ai verification', 'gps', 'shift checkin', 'photo', 'proof'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Couriers simply snap a selfie wearing their sponsor gear at the start of their delivery route.
          </p>
          <p>
            Our multi-modal <strong>AI Vision engine</strong> verifies that the partner gear is properly worn, while GPS tracks active route mileage during campaign hours. Once verified, daily wages are released instantly to your Stripe Treasury wallet.
          </p>
        </div>
      )
    }
  ];
};
