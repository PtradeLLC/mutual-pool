import React from 'react';
import { SupportedLanguage } from '../i18n/types';
import { 
  HelpCircle, Layers, Sparkles, Coins, Bot, ShieldCheck, Gift, 
  Lock
} from 'lucide-react';
import { TREASURY_PROGRAM_ENABLED } from '../lib/treasuryClaims';

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
    subtitle: 'Everything you need to know about Mutual Savings Pods, the 3% Creator Host Reward, security, and Autonomous AI Custodianship.',
    searchPlaceholder: 'Search questions by keyword (e.g. Creator Reward, Security, Defaults, Lainie AI, Fees, Payouts)...',
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
    subtitle: 'Todo lo que necesitas saber sobre los Grupos de Ahorro Mutuo, la Recompensa de Anfitrión del 3%, la seguridad y la Custodia Autónoma por IA.',
    searchPlaceholder: 'Buscar preguntas por palabra clave (ej. Recompensa Creador, Seguridad, Impagos, Lainie AI, Tarifas, Pagos)...',
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
    subtitle: 'Tout ce que vous devez savoir sur les Groupes d\'Épargne Mutuelle, la Prime Créateur de 3%, la sécurité et la Gardienne IA Autonome.',
    searchPlaceholder: 'Rechercher par mot-clé (ex. Prime Créateur, Sécurité, Impayés, Lainie AI, Frais, Versements)...',
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
    { id: 'SECURITY_FDIC', label: TREASURY_PROGRAM_ENABLED ? 'FDIC & KYC Security' : 'Security & KYC', icon: ShieldCheck },
    { id: 'AD_CAMPAIGNS', label: 'Brand Gear & Extra Earnings', icon: Gift },
  ],
  es: [
    { id: 'ALL', label: 'Todas las Preguntas', icon: HelpCircle },
    { id: 'BASICS', label: 'Conceptos Básicos y ROSCA', icon: Layers },
    { id: 'CREATOR_REWARDS', label: 'Recompensas del Creador (3%)', icon: Sparkles },
    { id: 'DEPOSITS_PAYOUTS', label: 'Depósitos, Cobros y Tarifas', icon: Coins },
    { id: 'AI_CUSTODIAN_ESCROW', label: 'Custodia IA y Escrow del Sistema', icon: Bot },
    { id: 'SECURITY_FDIC', label: TREASURY_PROGRAM_ENABLED ? 'Seguridad FDIC y Verificación KYC' : 'Seguridad y Verificación KYC', icon: ShieldCheck },
    { id: 'AD_CAMPAIGNS', label: 'Prendas de Marca e Ingresos Extra', icon: Gift },
  ],
  fr: [
    { id: 'ALL', label: 'Toutes les Questions', icon: HelpCircle },
    { id: 'BASICS', label: 'Bases & ROSCA / Tontines', icon: Layers },
    { id: 'CREATOR_REWARDS', label: 'Primes Créateur Hôte (3%)', icon: Sparkles },
    { id: 'DEPOSITS_PAYOUTS', label: 'Dépôts, Versements & Frais', icon: Coins },
    { id: 'AI_CUSTODIAN_ESCROW', label: 'Gardienne IA & Entiercement', icon: Bot },
    { id: 'SECURITY_FDIC', label: TREASURY_PROGRAM_ENABLED ? 'Sécurité FDIC & KYC' : 'Sécurité & KYC', icon: ShieldCheck },
    { id: 'AD_CAMPAIGNS', label: 'Équipement de Marque & Revenus', icon: Gift },
  ],
};

// Items that only apply once member funds are held in Stripe Treasury accounts.
const TREASURY_ONLY_FAQ_IDS = new Set(['faq_fdic_insurance']);

export const getFaqItems = (lang: SupportedLanguage): LocalizedFaqItem[] => getFaqItemsRaw(lang).filter(item => TREASURY_PROGRAM_ENABLED || !TREASURY_ONLY_FAQ_IDS.has(item.id));

const getFaqItemsRaw = (lang: SupportedLanguage): LocalizedFaqItem[] => {
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
              En lugar de recurrir a préstamos de día de pago con intereses abusivos, ahorras tus propios ingresos con compañeros verificados de la comunidad. Cada dólar aportado a la rotación proviene directamente de tus ingresos o de tu saldo de MutualPool.
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
                  Abierto a cualquier miembro verificado de MutualPool. Para crear un Grupo Abierto debes haber completado al menos un grupo, o llevar 90 días o más en MutualPool.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              En ambos casos necesitas identidad verificada y una autorización de débito bancario activa antes de poder crear o unirte a un grupo, y puedes tener como máximo 3 grupos creados por ti en formación o activos a la vez.
            </p>
          </div>
        )
      },
      {
        id: 'faq_pod_size_ladder',
        category: 'BASICS',
        question: '¿Hay un límite en el tamaño del grupo al que puedo unirme?',
        tags: ['tope fondo', 'tamano grupo', 'limite', '$1,000', '$2,500', '$5,000', 'historial', 'grupos completados', 'escalera'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Sí. El fondo máximo al que puedes unirte crece con tu historial en MutualPool. El fondo es el depósito semanal multiplicado por el número de miembros.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-700"><span>Sin grupos completados todavía</span><span className="font-bold">hasta $1,000</span></div>
              <div className="flex justify-between text-slate-700"><span>1 grupo completado</span><span className="font-bold">hasta $2,500</span></div>
              <div className="flex justify-between text-slate-700"><span>2 grupos completados</span><span className="font-bold">hasta $5,000</span></div>
              <div className="flex justify-between text-emerald-800 font-bold"><span>3 o más grupos completados</span><span>sin límite</span></div>
            </div>
            <p className="text-[11px] text-slate-600">
              Solo cuentan los grupos que terminaste sin fallar ningún depósito. Un depósito fallido sin resolver te devuelve al primer nivel hasta que se regularice.
            </p>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
              💡 <strong>Por qué:</strong> esto protege a cada grupo de alguien que cobra temprano y luego deja de depositar. Los miembros ganan acceso a fondos más grandes completando primero los más pequeños.
            </div>
          </div>
        )
      },
      {
        id: 'faq_early_slots_trust',
        category: 'BASICS',
        question: '¿Cómo se decide el orden de cobro? ¿Quién recibe los primeros turnos?',
        tags: ['orden rotacion', 'primeros turnos', 'confianza', 'antiguedad', '90 dias', 'experiencia', 'bloqueo', 'aleatorio', 'primera mitad'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Cuando el creador bloquea el grupo, la primera mitad de la rotación se asigna a los miembros con mejor historial. Dentro de cada nivel el orden es aleatorio, y el creador siempre ocupa el último turno.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Los miembros que han completado un grupo</strong> van primero.</li>
              <li><strong>Los miembros con 90+ días en MutualPool</strong> van después.</li>
              <li><strong>Los miembros más nuevos</strong> ocupan los turnos restantes.</li>
            </ol>
            <p>
              Para fondos superiores a <strong>$1,000</strong>, cada turno temprano debe estar ocupado por un miembro de los dos primeros niveles. Si no hay suficientes, el grupo no puede bloquearse hasta que se unan más miembros con experiencia o se reduzca el fondo. Los fondos de $1,000 o menos siempre se bloquean.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
              ⚖️ Los intercambios y las votaciones de repriorización no pueden colocar a un miembro más nuevo por delante de uno más consolidado en la primera mitad de la rotación.
            </div>
          </div>
        )
      },
      {
        id: 'faq_pod_commitment',
        category: 'BASICS',
        question: '¿Puedo salir de un grupo antes de tiempo? ¿A qué me comprometo al unirme?',
        tags: ['salir grupo', 'abandonar', 'compromiso', 'ciclo completo', 'despues del cobro', 'depositos restantes', 'obligacion'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Al crear o unirte a un grupo te comprometes al depósito semanal durante el <strong>ciclo completo</strong>, una semana por miembro, <strong>incluidas las semanas posteriores a recibir tu propio cobro</strong>. Eso es lo que hace posible el cobro de todos los demás.
            </p>
            <p>
              Solo puedes salir de un grupo una vez que todos los miembros hayan recibido su cobro. Si sales o te retiran después de cobrar, los depósitos que aún debes siguen pendientes, y MutualPool puede cobrarlos de tu saldo, de cobros futuros o de tu cuenta bancaria vinculada conforme a tu autorización de débito bancario.
            </p>
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
              ¡A lo largo de 19 cobros de compañeros, el Creador gana <strong>$228.00 acumulados</strong> acreditados directamente en su saldo de MutualPool!
            </p>
          </div>
        )
      },
      {
        id: 'faq_creator_swap_policy',
        category: 'CREATOR_REWARDS',
        question: '¿Puede el Creador del Grupo intercambiar su turno para cobrar antes? ¿Qué pasa con el 3% semanal?',
        tags: ['creador', 'intercambio turno', 'adelantar cobro', 'recompensa 3%', 'transferencia 3%', 'swap', 'anfitrion'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>¡Sí, totalmente!</strong> El Creador del pod puede intercambiar puestos en la rotación libremente con cualquier compañero (igual que cualquier otro miembro), por ejemplo si tiene una avería urgente del vehículo o un gasto imprevisto.
            </p>
            <p>
              Sin embargo, debido a que el <strong>corte semanal del 3% sobre todos los cobros de compañeros</strong> se otorga como compensación por asumir el riesgo y la responsabilidad de ocupar el último puesto de la rotación:
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium space-y-1">
              <div>⚖️ <strong>Regla de Transferencia del 3% Semanal:</strong></div>
              <div>El corte del 3% semanal en los cobros de los compañeros <strong>se otorgará a la persona con quien el Creador intercambie el turno</strong> una vez que el intercambio sea aprobado y quede activo.</div>
            </div>
            <p className="text-[11px] text-slate-600">
              <strong>Ejemplo Práctico:</strong> Si el Creador solicita adelantar su cobro intercambiando lugar con el 'Miembro X' (el Creador pasa al Turno #3 y el 'Miembro X' pasa al último Turno #20), el 3% semanal de compensación ($12.00 por desembolso en un grupo de $400) se pagará automáticamente al 'Miembro X' por ocupar la posición final.
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
        tags: ['deposito', 'pago', 'jueves', 'corte', 'saldo', 'automatico', 'banco', 'recarga'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Cada <strong>jueves a las 12:00 AM (hora del Este)</strong>, MutualPool toma el depósito de esa semana, más la tarifa de depósito del 5%, <strong>de tu saldo de MutualPool</strong> por cada grupo activo en el que participas. Mantén saldo suficiente para cubrirlo.
            </p>
            <p>Puedes fondear tu saldo de tres formas:</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Recarga con tarjeta a través de Stripe:</strong> sin tarifa de MutualPool por recargas.</li>
              <li><strong>Transferencia bancaria desde tu cuenta vinculada:</strong> conectada a través de Stripe.</li>
              <li><strong>Cobros y ganancias de campañas de marca:</strong> se acreditan en el mismo saldo, por lo que pueden cubrir depósitos futuros.</li>
            </ol>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
              ⚠️ Si tu saldo no puede cubrir un depósito, se registra como depósito fallido. Tienes hasta el cobro del viernes para recargar, y MutualPool puede debitar tu cuenta bancaria vinculada conforme a tu autorización de débito bancario.
            </div>
          </div>
        )
      },
      {
        id: 'faq_bank_debit_mandate',
        category: 'DEPOSITS_PAYOUTS',
        question: '¿Por qué debo autorizar débitos bancarios antes de poder crear o unirme a un grupo?',
        tags: ['debito bancario', 'ach', 'mandato', 'autorizacion', 'financial connections', 'banco vinculado', 'revocar'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Antes de crear o unirte a un grupo, vinculas una cuenta bancaria a través de Stripe y autorizas a MutualPool a debitarla. Los depósitos normalmente se toman de tu saldo; la autorización es el respaldo que permite que el grupo siga adelante si un saldo se queda sin fondos.
            </p>
            <p>Con la autorización solo podemos debitar tu cuenta bancaria por:</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li>un depósito semanal que tu saldo no pudo cubrir;</li>
              <li>cualquier monto que MutualPool haya adelantado en tu nombre, como un adelanto por dificultad;</li>
              <li>los depósitos restantes a los que te comprometiste si sales o te retiran de un grupo después de recibir su cobro.</li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Te avisamos en la app antes de cada débito. Puedes revocar la autorización contactando a soporte, pero eso no cancela lo que debes, y sin ella no puedes crear ni unirte a grupos.
            </p>
          </div>
        )
      },
      {
        id: 'faq_payout_fee_explained',
        category: 'DEPOSITS_PAYOUTS',
        question: '¿Cuáles son las tarifas de la plataforma y a dónde se destina el dinero?',
        tags: ['tarifas', '5%', '10%', '7%', 'tarifa servicio', 'costo', 'comisiones', 'tarifa retiro', 'recarga'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool cobra tres tarifas, y nada más. No hay intereses, no hay tarifa de retiro y no hay tarifa por recargas con tarjeta.
            </p>
            <ul className="space-y-2 text-[11px]">
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Tarifa de Depósito (5%):</strong> se cobra en <strong>cada depósito semanal</strong> al momento de tomarlo. En un depósito de $20, salen $21 de tu saldo.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Tarifa de Cobro (10%):</strong> se deduce de cada cobro de la rotación antes de acreditarlo (ej. $40 en un fondo de $400, así que el beneficiario recibe $360).
                <div className="mt-1 text-[10px] text-slate-600">
                  • <strong>3%</strong> del fondo va al miembro que ocupa el último turno (normalmente el creador) como Recompensa de Anfitrión.<br />
                  • <strong>7%</strong> va a MutualPool.
                </div>
              </li>
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Tarifa de Reembolso por Dificultad (7%):</strong> se añade a un adelanto por dificultad cuando lo reembolsas. Solo la pagas si usaste un adelanto por dificultad.
              </li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Los cambios de tarifas se anuncian en la app con al menos 30 días de antelación y solo aplican a los grupos que comiencen después del período de aviso.
            </p>
          </div>
        )
      },
      {
        id: 'faq_payout_execution',
        category: 'DEPOSITS_PAYOUTS',
        question: '¿Cómo y cuándo recibo mi pago acumulado?',
        tags: ['cobro', 'retiro', 'transferencia', 'turno', 'calendario', 'viernes', 'banco', '1-3 dias habiles'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Cada semana de liquidación sigue un calendario fijo: los depósitos se toman el <strong>jueves a las 12:00 AM (hora del Este)</strong>, y el cobro de la semana se acredita el <strong>viernes a las 12:00 AM (hora del Este)</strong>. Cuando es tu turno, el monto neto (ej. <strong>$360.00</strong> en un fondo de $400) llega a tu <strong>saldo de MutualPool</strong>.
            </p>
            <p>Desde tu saldo puedes:</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li>Retirarlo a la cuenta bancaria que verificaste con Stripe. No hay tarifa de retiro; tu banco normalmente lo acredita en 1 a 3 días hábiles.</li>
              <li>Dejarlo en tu saldo para cubrir tus depósitos semanales restantes. Los saldos no generan intereses.</li>
              <li><strong>Las semanas de rotación siguientes nunca esperan por un retiro bancario pendiente.</strong></li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Los fondos depositados recientemente pueden retenerse mientras un pago con tarjeta todavía sea impugnable, y los fondos sujetos a un contracargo, reembolso o revisión por fraude pueden retenerse o revertirse.
            </p>
          </div>
        )
      },
      {
        id: 'faq_missed_deposit_default',
        category: 'AI_CUSTODIAN_ESCROW',
        question: '¿Qué ocurre si un miembro no realiza un depósito semanal o incurre en impago?',
        tags: ['pago retrasado', 'impago', 'colchon contingencia', 'welcome match', 'periodo gracia', 'retiro del grupo', 'cobranza', 'deuda'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Si el corte del jueves encuentra un saldo que no puede cubrir el depósito, esto es lo que ocurre, en orden:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
              <li><strong>Se avisa a todos.</strong> Se registra el depósito fallido, y el miembro <em>y todos los demás miembros del grupo</em> reciben un correo y un aviso en la app. El miembro tiene <strong>24 horas</strong> para pagar. Un depósito tardío reembolsa lo que se haya cubierto en lugar de inflar el fondo.</li>
              <li><strong>La semana puede cubrirse.</strong> El colchón de contingencia del grupo (el Welcome Match de un primer grupo, equivalente a un depósito) o el escrow de MutualPool pueden cubrir la semana para que el cobro del viernes se realice igual. Todo lo cubierto se convierte en dinero que el miembro debe.</li>
              <li><strong>24 horas después, sin pagar: retiro y restricción.</strong> El miembro es retirado del grupo, y los demás miembros votan si publicar el grupo para cubrir el lugar o mantenerlo privado. Su cuenta queda restringida: no puede crear ni unirse a grupos, ni intercambiar turnos, votar o pedir ayuda por dificultad. Aún puede recargar y pagar.</li>
              <li><strong>La cobranza empieza automáticamente.</strong> Todo lo adeudado se debita de su cuenta bancaria vinculada conforme a la autorización dada al unirse, y también puede tomarse de su saldo o de cobros futuros. El dinero recuperado reembolsa el escrow, restaura el colchón y cubre las semanas posteriores del grupo.</li>
              <li><strong>Pagado en su totalidad: restaurado.</strong> Una vez saldadas todas las moras, la cuenta se restaura automáticamente.</li>
              <li><strong>Una segunda mora en el mismo grupo abre una votación.</strong> El segundo miembro recibe una advertencia, y los miembros que no están en mora votan <strong>pausar</strong> el grupo (sin depósitos ni cobros hasta que se resuelvan las moras) o <strong>cubrir</strong> los depósitos faltantes entre ellos cada jueves. Decide la mayoría; la votación cierra a las 48 horas y, si no se decide, el grupo se pausa.</li>
            </ol>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
              ⚠️ Un miembro que cobra y luego deja de depositar sigue debiendo todos los depósitos restantes del ciclo, y el monto se reclama. Un depósito fallido también lo devuelve al límite de tamaño de grupo de $1,000 hasta que se regularice.
            </div>
            <p className="text-[11px] text-slate-600">
              Los colchones y el escrow existen para mantener los cobros a tiempo, pero son limitados y discrecionales. En última instancia, los miembros dependen unos de otros, y por eso existen la escalera de tamaño de grupo y las reglas de los primeros turnos.
            </p>
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
                • El Creador pierde su Recompensa de Anfitrión del 3%.<br />
                • Ese 3% se redirige a la <strong>Cuenta de Depósitos de Custodia (Escrow) del Sistema</strong> para respaldar futuros cobros de los miembros.
              </p>
            </div>
          </div>
        )
      },
      {
        id: 'faq_system_escrow',
        category: 'AI_CUSTODIAN_ESCROW',
        question: '¿Qué es la Cuenta de Depósitos de Custodia (Escrow) del Sistema?',
        tags: ['escrow sistema', 'liquidez', 'adelanto', 'reserva', 'faltante', 'cobertura'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              La <strong>Cuenta de Depósitos de Custodia del Sistema</strong> es una reserva de liquidez gestionada por MutualPool.
            </p>
            <p>
              Cuando el colchón de contingencia propio de un grupo no puede cubrir un depósito fallido, el escrow puede cubrir el depósito de la semana (ej. <strong>$20.00</strong>) para que el cobro programado se realice igual. Todo lo que el escrow adelanta se convierte en dinero que el miembro ausente debe, y cualquier monto que luego se recupere de él reembolsa primero al escrow.
            </p>
            <p className="text-[11px] text-slate-600">
              El escrow es limitado y se usa a discreción de MutualPool. Es un respaldo, no una garantía de que se cubrirá cada faltante causado por otro miembro.
            </p>
          </div>
        )
      },
      {
        id: 'faq_hardship_relief',
        category: 'AI_CUSTODIAN_ESCROW',
        question: '¿Qué sucede si tengo dificultades personales o financieras durante un ciclo activo?',
        tags: ['dificultad', 'emergencia', 'adelanto', 'accidente', 'medico', 'alivio', '90 dias', 'reembolso', '7%'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              El trabajo independiente es impredecible: hay averías, accidentes y emergencias médicas. Si una coincide con una semana de depósito, puedes enviar una <strong>Solicitud por Dificultad</strong> desde la pantalla de tu grupo.
            </p>
            <p>
              Una solicitud aprobada significa que <strong>MutualPool realiza ese depósito semanal en tu nombre</strong>, para que tu grupo siga en calendario y conserves tu buena reputación. Es un adelanto contra tus propios cobros futuros, no un préstamo.
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li>Eres elegible después de <strong>90 días</strong> como miembro de un grupo.</li>
              <li>MutualPool revisa las solicitudes y puede rechazarlas. Aplican límites por grupo y por semana (un adelanto aprobado por grupo por ciclo, y como máximo dos pendientes por grupo).</li>
              <li>El adelanto debe reembolsarse, más la <strong>tarifa de reembolso por dificultad del 7%</strong>, antes de que puedas unirte a otro grupo o crear uno.</li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Si un <em>creador</em> entra en una pausa por dificultad, la Custodia Autónoma de Lainie asume la gestión del grupo para que los demás miembros no se vean afectados.
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
              Stripe, que procesa cada depósito, cobro, retiro y débito bancario en MutualPool, exige una identidad verificada antes de mover dinero por ti, conforme a las normas federales de prevención de lavado de dinero.
            </p>
            <p>
              La verificación también protege al propio grupo: garantiza una sola cuenta por persona y que las personas a las que confías tus depósitos semanales sean reales y autenticadas, no cuentas duplicadas o desechables.
            </p>
          </div>
        )
      },
      {
        id: 'faq_slot_swap',
        category: 'SECURITY_FDIC',
        question: '¿Pueden los miembros intercambiar turnos para cobrar antes? ¿Aplica también al Creador?',
        tags: ['intercambio', 'repriorizar', 'votacion', 'cambio turno', 'adelantar cobro', 'creador swap', 'emergencia', 'orden rotacion', 'swap'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>Sí.</strong> Hay dos formas de adelantarte cuando surge un gasto inesperado:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Intercambio de turno:</strong> envía una propuesta a otro miembro. Cuando ambos aceptan en la app, sus posiciones se intercambian y el calendario se actualiza para todo el grupo.</li>
              <li><strong>Votación de repriorización:</strong> pide al grupo que te mueva al siguiente turno de cobro. Si más de la mitad de los miembros vota a favor, ocupas ese turno y el miembro desplazado pasa a tu antiguo turno.</li>
            </ul>
            <p>
              <strong>¿El Creador también puede intercambiar turnos?</strong> Sí, como cualquier otro miembro. Pero la <strong>Recompensa de Anfitrión del 3% va con el último turno</strong>: quien termine ocupándolo recibe el 3% de cada cobro posterior.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium space-y-1">
              <div>⚖️ <strong>Límites:</strong></div>
              <div>• Los miembros que ya recibieron su cobro no pueden intercambiar.</div>
              <div>• En la primera mitad de la rotación, ningún intercambio ni votación puede colocar a un miembro más nuevo por delante de uno más consolidado, y en fondos superiores a $1,000 cada turno temprano debe permanecer con un miembro que haya completado un grupo o tenga 90+ días en MutualPool.</div>
            </div>
            <p className="text-[11px] text-slate-600">
              El resultado de cada intercambio y votación queda registrado en el historial de auditoría del grupo y es vinculante para todos los miembros.
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
              <li><strong>Abono en tu saldo de MutualPool:</strong> Los ingresos diarios se acreditan en tu saldo una vez que cada turno es verificado por IA Vision, listos para retirar o para cubrir tus depósitos semanales del grupo.</li>
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
              Nuestro motor de <strong>IA Visual multimodal</strong> verifica que el equipamiento se use correctamente, mientras el GPS registra el kilometraje de la ruta activa durante las horas de la campaña. Una vez verificado, los ingresos diarios se acreditan en tu saldo de MutualPool.
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
              Plutôt que d'emprunter auprès d'organismes de crédit à taux usuraires, vous mutualisez vos propres revenus avec des pairs vérifiés de votre communauté. Chaque dollar versé dans la rotation provient directement de vos revenus ou de votre solde MutualPool.
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
                  Ouvert à tout membre vérifié de MutualPool. Pour créer un Groupe Ouvert, vous devez avoir complété au moins un groupe, ou être membre de MutualPool depuis 90 jours ou plus.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              Dans les deux cas, vous devez avoir une identité vérifiée et une autorisation de prélèvement bancaire active avant de pouvoir créer ou rejoindre un groupe, et vous pouvez avoir au maximum 3 groupes créés par vous en formation ou actifs en même temps.
            </p>
          </div>
        )
      },
      {
        id: 'faq_pod_size_ladder',
        category: 'BASICS',
        question: 'Y a-t-il une limite à la taille du groupe que je peux rejoindre ?',
        tags: ['plafond cagnotte', 'taille groupe', 'limite', '1000', '2500', '5000', 'historique', 'groupes completes', 'paliers'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Oui. La cagnotte maximale que vous pouvez rejoindre augmente avec votre historique sur MutualPool. La cagnotte correspond à la cotisation hebdomadaire multipliée par le nombre de membres.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-slate-700"><span>Aucun groupe complété pour l'instant</span><span className="font-bold">jusqu'à 1 000 $</span></div>
              <div className="flex justify-between text-slate-700"><span>1 groupe complété</span><span className="font-bold">jusqu'à 2 500 $</span></div>
              <div className="flex justify-between text-slate-700"><span>2 groupes complétés</span><span className="font-bold">jusqu'à 5 000 $</span></div>
              <div className="flex justify-between text-emerald-800 font-bold"><span>3 groupes complétés ou plus</span><span>aucune limite</span></div>
            </div>
            <p className="text-[11px] text-slate-600">
              Seuls les groupes terminés sans aucune cotisation manquée comptent. Une cotisation manquée non régularisée vous ramène au premier palier jusqu'à son règlement.
            </p>
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
              💡 <strong>Pourquoi :</strong> cela protège chaque groupe contre une personne qui encaisse un versement anticipé puis cesse de cotiser. Les membres gagnent l'accès à des cagnottes plus importantes en terminant d'abord les plus petites.
            </div>
          </div>
        )
      },
      {
        id: 'faq_early_slots_trust',
        category: 'BASICS',
        question: 'Comment l\'ordre des versements est-il décidé ? Qui obtient les premiers créneaux ?',
        tags: ['ordre rotation', 'premiers creneaux', 'confiance', 'anciennete', '90 jours', 'experimente', 'verrouillage', 'aleatoire', 'premiere moitie'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Lorsque le créateur verrouille le groupe, la première moitié de la rotation est attribuée aux membres ayant le meilleur historique. Au sein de chaque palier, l'ordre est aléatoire, et le créateur occupe toujours le dernier créneau.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Les membres ayant complété un groupe</strong> passent en premier.</li>
              <li><strong>Les membres présents depuis 90 jours ou plus sur MutualPool</strong> viennent ensuite.</li>
              <li><strong>Les membres plus récents</strong> occupent les créneaux restants.</li>
            </ol>
            <p>
              Pour les cagnottes supérieures à <strong>1 000 $</strong>, chaque créneau anticipé doit être occupé par un membre des deux premiers paliers. S'il n'y en a pas assez, le groupe ne peut pas être verrouillé tant que des membres plus expérimentés ne l'ont pas rejoint ou que la cagnotte n'a pas été réduite. Les cagnottes de 1 000 $ ou moins se verrouillent toujours.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
              ⚖️ Les échanges et les votes de repriorisation ne peuvent pas placer un membre plus récent devant un membre plus établi dans la première moitié de la rotation.
            </div>
          </div>
        )
      },
      {
        id: 'faq_pod_commitment',
        category: 'BASICS',
        question: 'Puis-je quitter un groupe avant la fin ? À quoi est-ce que je m\'engage en rejoignant ?',
        tags: ['quitter groupe', 'abandon', 'engagement', 'cycle complet', 'apres versement', 'cotisations restantes', 'obligation'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Lorsque vous créez ou rejoignez un groupe, vous vous engagez à verser la cotisation hebdomadaire pendant le <strong>cycle complet</strong>, une semaine par membre, <strong>y compris les semaines qui suivent la réception de votre propre versement</strong>. C'est ce qui rend possible le versement de tous les autres.
            </p>
            <p>
              Vous ne pouvez quitter un groupe qu'une fois que chaque membre a reçu son versement. Si vous partez ou êtes retiré après avoir encaissé votre versement, les cotisations que vous devez encore restent dues, et MutualPool peut les recouvrer sur votre solde, sur vos versements futurs ou sur votre compte bancaire lié dans le cadre de votre autorisation de prélèvement bancaire.
            </p>
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
              Sur 19 versements de coéquipiers, le Créateur accumule <strong>228,00 $ de primes</strong> créditées directement sur son solde MutualPool !
            </p>
          </div>
        )
      },
      {
        id: 'faq_creator_swap_policy',
        category: 'CREATOR_REWARDS',
        question: 'Le Créateur du groupe peut-il échanger sa place pour un versement anticipé ? Qu\'advient-il des 3 % ?',
        tags: ['createur', 'echange place', 'versement anticipe', 'prime 3%', 'transfert 3%', 'swap', 'hote'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>Oui, absolument !</strong> Le Créateur du groupe peut librement échanger son rang dans la rotation avec n'importe quel coéquipier (exactement comme tout autre membre), par exemple en cas de réparation urgente de véhicule ou d'imprévu financier.
            </p>
            <p>
              Cependant, comme la <strong>prime hebdomadaire de 3 % sur tous les versements des coéquipiers</strong> rémunère l'engagement d'occuper la dernière place de la rotation :
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium space-y-1">
              <div>⚖️ <strong>Règle de Transfert des 3 % Hebdomadaires :</strong></div>
              <div>La prime de 3 % sur les versements des coéquipiers <strong>sera attribuée au membre avec lequel le Créateur a échangé sa place</strong> dès que l'échange est validé et actif.</div>
            </div>
            <p className="text-[11px] text-slate-600">
              <strong>Exemple Pratique :</strong> Si le Créateur demande à avancer son versement au Tour n°3 et échange avec le « Membre X » (qui récupère la dernière place au Tour n°20), la prime de 3 % (12,00 $/versement sur un pot de 400 $) sera versée au Membre X pour tous les versements ultérieurs.
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
        tags: ['depot', 'paiement', 'jeudi', 'prelevement', 'solde', 'automatique', 'banque', 'recharge'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Chaque <strong>jeudi à 00 h 00 (heure de l'Est)</strong>, MutualPool prélève la cotisation de la semaine, plus les frais de dépôt de 5 %, <strong>sur votre solde MutualPool</strong> pour chaque groupe actif dont vous faites partie. Gardez un solde suffisant pour la couvrir.
            </p>
            <p>Vous pouvez approvisionner votre solde de trois façons :</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Recharge par carte via Stripe :</strong> aucun frais MutualPool sur les recharges.</li>
              <li><strong>Virement bancaire depuis votre compte lié :</strong> connecté via Stripe.</li>
              <li><strong>Versements et gains de campagnes de marque :</strong> crédités sur le même solde, ils peuvent donc couvrir vos futures cotisations.</li>
            </ol>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
              ⚠️ Si votre solde ne peut pas couvrir une cotisation, elle est enregistrée comme cotisation manquée. Vous avez jusqu'au versement du vendredi pour recharger, et MutualPool peut prélever votre compte bancaire lié dans le cadre de votre autorisation de prélèvement bancaire.
            </div>
          </div>
        )
      },
      {
        id: 'faq_bank_debit_mandate',
        category: 'DEPOSITS_PAYOUTS',
        question: 'Pourquoi dois-je autoriser les prélèvements bancaires avant de pouvoir créer ou rejoindre un groupe ?',
        tags: ['prelevement bancaire', 'ach', 'mandat', 'autorisation', 'financial connections', 'banque liee', 'revoquer'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Avant de créer ou rejoindre un groupe, vous liez un compte bancaire via Stripe et autorisez MutualPool à le prélever. Les cotisations sont normalement prises sur votre solde ; l'autorisation est le filet de sécurité qui permet au groupe de continuer si un solde est à sec.
            </p>
            <p>Dans le cadre de cette autorisation, nous ne pouvons prélever votre compte bancaire que pour :</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li>une cotisation hebdomadaire que votre solde n'a pas pu couvrir ;</li>
              <li>tout montant avancé par MutualPool en votre nom, comme une avance pour coup dur ;</li>
              <li>les cotisations restantes auxquelles vous vous êtes engagé si vous quittez ou êtes retiré d'un groupe après avoir reçu son versement.</li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Nous vous prévenons dans l'application avant chaque prélèvement. Vous pouvez révoquer l'autorisation en contactant le support, mais cela n'annule pas ce que vous devez, et vous ne pouvez ni créer ni rejoindre de groupes sans elle.
            </p>
          </div>
        )
      },
      {
        id: 'faq_payout_fee_explained',
        category: 'DEPOSITS_PAYOUTS',
        question: 'Quels sont les frais de plateforme et à quoi servent-ils ?',
        tags: ['frais', '5%', '10%', '7%', 'frais service', 'cout', 'commissions', 'frais retrait', 'recharge'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              MutualPool applique trois frais, et rien d'autre. Il n'y a aucun intérêt, aucun frais de retrait et aucun frais sur les recharges par carte.
            </p>
            <ul className="space-y-2 text-[11px]">
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Frais de Dépôt (5 %) :</strong> appliqués sur <strong>chaque cotisation hebdomadaire</strong> au moment du prélèvement. Pour une cotisation de 20 $, 21 $ sont débités de votre solde.
              </li>
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Frais de Versement (10 %) :</strong> déduits de chaque versement de la rotation avant qu'il ne soit crédité (ex. 40 $ sur une cagnotte de 400 $, le bénéficiaire reçoit donc 360 $).
                <div className="mt-1 text-[10px] text-slate-600">
                  • <strong>3 %</strong> de la cagnotte vont au membre qui occupe le dernier créneau (normalement le créateur) au titre de la Prime Hôte.<br />
                  • <strong>7 %</strong> vont à MutualPool.
                </div>
              </li>
              <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <strong>Frais de Remboursement pour Coup Dur (7 %) :</strong> ajoutés à une avance pour coup dur lorsque vous la remboursez. Vous ne les payez que si vous avez utilisé une avance pour coup dur.
              </li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Les modifications de frais sont annoncées dans l'application au moins 30 jours à l'avance et ne s'appliquent qu'aux groupes qui démarrent après la période de préavis.
            </p>
          </div>
        )
      },
      {
        id: 'faq_payout_execution',
        category: 'DEPOSITS_PAYOUTS',
        question: 'Comment et quand vais-je recevoir mon versement forfaitaire ?',
        tags: ['versement', 'retrait', 'virement', 'tour', 'calendrier', 'vendredi', 'banque', '1-3 jours ouvres'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Chaque semaine de règlement suit un calendrier fixe : les cotisations sont prélevées le <strong>jeudi à 00 h 00 (heure de l'Est)</strong>, et le versement de la semaine est crédité le <strong>vendredi à 00 h 00 (heure de l'Est)</strong>. Quand c'est votre tour, le montant net (ex. <strong>360,00 $</strong> sur une cagnotte de 400 $) arrive sur votre <strong>solde MutualPool</strong>.
            </p>
            <p>Depuis votre solde, vous pouvez :</p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li>Le retirer vers le compte bancaire que vous avez vérifié avec Stripe. Il n'y a aucun frais de retrait ; votre banque crédite généralement les fonds sous 1 à 3 jours ouvrés.</li>
              <li>Le laisser sur votre solde pour couvrir vos cotisations hebdomadaires restantes. Les soldes ne produisent pas d'intérêts.</li>
              <li><strong>Les semaines de rotation suivantes n'attendent jamais un retrait bancaire en cours.</strong></li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Les fonds récemment déposés peuvent être retenus tant qu'un paiement par carte reste contestable, et les fonds faisant l'objet d'une rétrofacturation, d'un remboursement ou d'un contrôle antifraude peuvent être retenus ou annulés.
            </p>
          </div>
        )
      },
      {
        id: 'faq_missed_deposit_default',
        category: 'AI_CUSTODIAN_ESCROW',
        question: 'Que se passe-t-il si un membre manque un dépôt hebdomadaire ou est en défaut de paiement ?',
        tags: ['impaye', 'defaut', 'tampon continuite', 'welcome match', 'periode grace', 'retrait du groupe', 'recouvrement', 'dette'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Si le prélèvement du jeudi trouve un solde qui ne peut pas couvrir la cotisation, voici ce qui se passe, dans l'ordre :
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
              <li><strong>Tout le monde est prévenu.</strong> La cotisation manquée est enregistrée, et le membre <em>ainsi que tous les autres membres du groupe</em> reçoivent un e-mail et une notification. Le membre a <strong>24 heures</strong> pour payer. Une cotisation tardive rembourse ce qui a été avancé au lieu de gonfler la cagnotte.</li>
              <li><strong>La semaine peut être couverte.</strong> Le tampon de continuité du groupe (le Welcome Match d'un premier groupe, égal à une cotisation) ou l'entiercement MutualPool peuvent couvrir la semaine pour que le versement du vendredi ait lieu. Tout ce qui est avancé devient une somme que le membre doit.</li>
              <li><strong>24 heures plus tard, toujours impayé : retrait et restriction.</strong> Le membre est retiré du groupe, et les membres restants votent pour publier le groupe afin de pourvoir la place ou le garder privé. Son compte est restreint : impossible de créer ou rejoindre un groupe, d'échanger une place, de voter ou de demander une aide. Il peut toujours recharger et payer.</li>
              <li><strong>Le recouvrement démarre automatiquement.</strong> Tout ce qui est dû est prélevé sur son compte bancaire lié, dans le cadre de l'autorisation donnée à l'adhésion, et peut aussi être pris sur son solde ou ses versements futurs. L'argent récupéré rembourse l'entiercement, reconstitue le tampon et couvre les semaines suivantes du groupe.</li>
              <li><strong>Payé intégralement : rétabli.</strong> Une fois tous les défauts réglés, le compte est rétabli automatiquement.</li>
              <li><strong>Un second défaut dans le même groupe ouvre un vote.</strong> Le second membre est averti, et les membres qui ne sont pas en défaut votent pour <strong>mettre en pause</strong> le groupe (ni cotisations ni versements tant que les défauts ne sont pas réglés) ou pour <strong>couvrir</strong> les cotisations manquantes entre eux chaque jeudi. La majorité décide ; le vote se termine après 48 heures et, sans décision, le groupe est mis en pause.</li>
            </ol>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
              ⚠️ Un membre qui encaisse un versement puis cesse de cotiser doit toujours toutes les cotisations restantes du cycle, et la somme est recouvrée. Une cotisation manquée le ramène également à la limite de taille de groupe de 1 000 $ jusqu'à régularisation.
            </div>
            <p className="text-[11px] text-slate-600">
              Les tampons et l'entiercement servent à maintenir les versements à l'heure, mais ils sont limités et discrétionnaires. En définitive, les membres comptent les uns sur les autres, et c'est pourquoi les paliers de taille de groupe et les règles des premiers créneaux existent.
            </p>
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
                • Le Créateur perd sa Prime Hôte de 3 %.<br />
                • Ces 3 % sont réaffectés au <strong>Compte d'Entiercement Système</strong> pour sécuriser les versements futurs des membres.
              </p>
            </div>
          </div>
        )
      },
      {
        id: 'faq_system_escrow',
        category: 'AI_CUSTODIAN_ESCROW',
        question: 'Qu\'est-ce que le Compte d\'Entiercement Système (Escrow) ?',
        tags: ['entiercement systeme', 'liquidite', 'avance', 'reserve', 'manque', 'relais'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Le <strong>Compte d'Entiercement Système</strong> est une réserve de liquidité gérée par MutualPool.
            </p>
            <p>
              Lorsque le tampon de continuité propre à un groupe ne peut pas couvrir une cotisation manquée, l'entiercement peut avancer la cotisation de la semaine (ex. <strong>20,00 $</strong>) afin que le versement programmé parte quand même. Tout ce que l'entiercement avance devient une somme due par le membre défaillant, et tout ce qui est ensuite récupéré auprès de lui rembourse d'abord l'entiercement.
            </p>
            <p className="text-[11px] text-slate-600">
              L'entiercement est limité et utilisé à la discrétion de MutualPool. C'est un filet de sécurité, pas une garantie que chaque manque causé par un autre membre sera couvert.
            </p>
          </div>
        )
      },
      {
        id: 'faq_hardship_relief',
        category: 'AI_CUSTODIAN_ESCROW',
        question: 'Que se passe-t-il si je rencontre une difficulté personnelle ou financière durant un cycle actif ?',
        tags: ['difficulte', 'urgence', 'avance', 'accident', 'medical', 'aide', '90 jours', 'rembourser', '7%'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              Le travail indépendant est imprévisible : pannes, accidents et urgences médicales arrivent. Si l'un d'eux tombe sur une semaine de cotisation, vous pouvez soumettre une <strong>Demande d'Aide pour Coup Dur</strong> depuis l'écran de votre groupe.
            </p>
            <p>
              Une demande approuvée signifie que <strong>MutualPool effectue cette cotisation hebdomadaire en votre nom</strong>, afin que votre groupe reste dans les temps et que vous conserviez votre bonne réputation. C'est une avance sur vos propres versements futurs, pas un prêt.
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li>Vous devenez éligible après <strong>90 jours</strong> d'appartenance à un groupe.</li>
              <li>Les demandes sont examinées par MutualPool et peuvent être refusées. Des limites s'appliquent par groupe et par semaine (une avance approuvée par groupe et par cycle, au maximum deux en cours par groupe).</li>
              <li>L'avance doit être remboursée, plus les <strong>frais de remboursement pour coup dur de 7 %</strong>, avant de pouvoir rejoindre ou créer un autre groupe.</li>
            </ul>
            <p className="text-[11px] text-slate-600">
              Si un <em>créateur</em> entre en suspension pour coup dur, la Gardienne Autonome Lainie reprend la gestion du groupe afin que les autres membres ne soient pas affectés.
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
              Stripe, qui traite chaque cotisation, versement, retrait et prélèvement bancaire sur MutualPool, exige une identité vérifiée avant de déplacer de l'argent pour vous, conformément aux règles fédérales de lutte contre le blanchiment.
            </p>
            <p>
              La vérification protège aussi le groupe lui-même : elle impose un seul compte par personne et garantit que les membres à qui vous confiez vos cotisations hebdomadaires sont des personnes réelles et authentifiées, pas des comptes en double ou jetables.
            </p>
          </div>
        )
      },
      {
        id: 'faq_slot_swap',
        category: 'SECURITY_FDIC',
        question: 'Les membres peuvent-ils échanger leur place dans la rotation pour un versement anticipé ? Est-ce aussi valable pour le Créateur ?',
        tags: ['echange', 'repriorisation', 'vote', 'creneau', 'versement anticipe', 'createur swap', 'urgence', 'ordre rotation', 'swap'],
        answer: (
          <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>Oui.</strong> Il existe deux façons d'avancer dans la rotation lorsqu'une dépense imprévue survient :
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
              <li><strong>Échange de place :</strong> envoyez une proposition à un autre membre. Dès que vous avez tous les deux accepté dans l'application, vos positions sont échangées et le calendrier est mis à jour pour tout le groupe.</li>
              <li><strong>Vote de repriorisation :</strong> demandez au groupe de vous placer sur le prochain créneau de versement. Si plus de la moitié des membres votent oui, vous prenez ce créneau et le membre déplacé reprend votre ancienne place.</li>
            </ul>
            <p>
              <strong>Le Créateur peut-il aussi échanger sa place ?</strong> Oui, comme tout autre membre. Mais la <strong>Prime Hôte de 3 % suit le dernier créneau</strong> : celui qui finit par l'occuper reçoit les 3 % sur chaque versement ultérieur.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium space-y-1">
              <div>⚖️ <strong>Limites :</strong></div>
              <div>• Les membres ayant déjà reçu leur versement ne peuvent pas échanger.</div>
              <div>• Dans la première moitié de la rotation, aucun échange ni vote ne peut placer un membre plus récent devant un membre plus établi, et pour les cagnottes supérieures à 1 000 $, chaque créneau anticipé doit rester attribué à un membre ayant complété un groupe ou présent depuis 90 jours ou plus sur MutualPool.</div>
            </div>
            <p className="text-[11px] text-slate-600">
              Le résultat de chaque échange et de chaque vote est consigné dans le journal d'audit du groupe et engage tous les membres.
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
              <li><strong>Crédité sur votre solde MutualPool :</strong> Vos gains quotidiens sont crédités sur votre solde dès la validation de chaque tournée par IA Vision, prêts à être retirés ou à couvrir vos cotisations hebdomadaires de groupe.</li>
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
              Notre moteur de <strong>Vision IA multimodal</strong> vérifie le port de l'équipement, tandis que le GPS enregistre le kilométrage actif pendant les heures de campagne. Une fois validé, votre rémunération quotidienne est créditée sur votre solde MutualPool.
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
            Instead of borrowing from a predatory payday lender, you are pooling your own hard-earned income with verified community peers. Every dollar paid into the rotation comes directly from your earnings or your MutualPool balance.
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
                Open to any verified MutualPool member. To create an Open Pod you must have completed at least one pod, or have been on MutualPool for 90 days or more.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-600">
            Either way, you need verified identity and an active bank debit authorization before you can create or join a pod, and you can have at most 3 pods you created forming or active at once.
          </p>
        </div>
      )
    },
    {
      id: 'faq_pod_size_ladder',
      category: 'BASICS',
      question: 'Is there a limit on the size of pod I can join?',
      tags: ['pot cap', 'pod size', 'limit', '$1,000', '$2,500', '$5,000', 'track record', 'completed pods', 'ladder'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Yes. The largest pot you can join grows with your track record on MutualPool. A pot is the weekly deposit multiplied by the number of members.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-slate-700"><span>No completed pods yet</span><span className="font-bold">up to $1,000</span></div>
            <div className="flex justify-between text-slate-700"><span>1 completed pod</span><span className="font-bold">up to $2,500</span></div>
            <div className="flex justify-between text-slate-700"><span>2 completed pods</span><span className="font-bold">up to $5,000</span></div>
            <div className="flex justify-between text-emerald-800 font-bold"><span>3 or more completed pods</span><span>no limit</span></div>
          </div>
          <p className="text-[11px] text-slate-600">
            Only pods you finished without missing a deposit count. An unresolved missed deposit puts you back on the first tier until it is settled.
          </p>
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
            💡 <strong>Why:</strong> this protects every pod from someone who takes an early payout and then stops depositing. Members earn access to bigger pots by finishing smaller ones first.
          </div>
        </div>
      )
    },
    {
      id: 'faq_early_slots_trust',
      category: 'BASICS',
      question: 'How is the payout order decided? Who gets the early slots?',
      tags: ['rotation order', 'early slots', 'trust', 'tenure', '90 days', 'seasoned', 'lock', 'random', 'first half'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            When the creator locks the pod, the first half of the rotation goes to the members with the strongest track record. Within each group the order is random, and the creator always takes the final slot.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li><strong>Members who have completed a pod</strong> come first.</li>
            <li><strong>Members with 90+ days on MutualPool</strong> come next.</li>
            <li><strong>Newer members</strong> fill the remaining slots.</li>
          </ol>
          <p>
            For pots over <strong>$1,000</strong>, every early slot must be held by a member from the first two groups. If there are not enough of them, the pod cannot lock until more experienced members join or the pot is reduced. Pots of $1,000 or less always lock.
          </p>
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
            ⚖️ Swaps and reprioritization votes cannot move a newer member ahead of a more established one in the early half of the rotation.
          </div>
        </div>
      )
    },
    {
      id: 'faq_pod_commitment',
      category: 'BASICS',
      question: 'Can I leave a pod early? What am I committing to when I join?',
      tags: ['leave pod', 'quit', 'commitment', 'full cycle', 'after payout', 'remaining deposits', 'obligation'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            When you create or join a pod you commit to the weekly deposit for the <strong>full cycle</strong>, one week per member, <strong>including the weeks after you have received your own payout</strong>. That is what makes everyone else's payout possible.
          </p>
          <p>
            You can leave a pod only once every member has received a payout. If you leave or are removed after taking your payout, the deposits you still owe remain due, and MutualPool may collect them from your balance, from future payouts, or from your linked bank account under your bank debit authorization.
          </p>
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
            Over 19 teammate payouts, the Creator earns <strong>$228.00 in cumulative host rewards</strong> credited directly to their MutualPool balance!
          </p>
        </div>
      )
    },
    {
      id: 'faq_creator_swap_policy',
      category: 'CREATOR_REWARDS',
      question: 'Can the Pod Creator switch places for an early payout? What happens to the 3% cut?',
      tags: ['creator', 'swap spot', 'early payout', 'switch places', '3% cut', 'host reward', 'transfer cut', 'stewardship'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>Yes, absolutely!</strong> The Pod Creator can switch places with any teammate just like any other pod member (for instance, if the Creator encounters an unexpected mechanical breakdown or urgent expense and needs an early payout).
          </p>
          <p>
            However, because the <strong>3% weekly stewardship cut on teammate payouts</strong> is compensation for holding the final payout position and maintaining skin-in-the-game:
          </p>
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium space-y-1">
            <div>⚖️ <strong>3% Stewardship Transfer Policy:</strong></div>
            <div>The 3% weekly cut on all teammate payouts <strong>will be given to whomever the Creator switches spots with</strong> once the switch is approved and active.</div>
          </div>
          <p className="text-[11px] text-slate-600">
            <strong>Example:</strong> If the Creator asks to switch places for an early payout with 'Member X' (e.g. Creator moves from Week 20 to Week 3, and Member X moves to the final Week 20 slot), the 3% weekly cut ($12.00/payout in a $400 pod) will be paid directly to Member X for taking on the final payout slot!
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
      tags: ['deposit', 'payment', 'thursday', 'sweep', 'balance', 'automatic', 'bank', 'top up'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Every <strong>Thursday at 12:00 AM Eastern</strong>, MutualPool takes that week's deposit, plus the 5% deposit fee, <strong>from your MutualPool balance</strong> for each active pod you are in. Keep enough balance to cover it.
          </p>
          <p>You can fund your balance in three ways:</p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li><strong>Card top-up through Stripe:</strong> no MutualPool fee on top-ups.</li>
            <li><strong>Bank transfer from your linked account:</strong> connected through Stripe.</li>
            <li><strong>Payouts and brand campaign earnings:</strong> credited to the same balance, so they can cover future deposits.</li>
          </ol>
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
            ⚠️ If your balance cannot cover a deposit, it is recorded as a missed deposit. You have until the Friday payout to top up, and MutualPool may debit your linked bank account under your bank debit authorization.
          </div>
        </div>
      )
    },
    {
      id: 'faq_bank_debit_mandate',
      category: 'DEPOSITS_PAYOUTS',
      question: 'Why do I have to authorize bank debits before I can create or join a pod?',
      tags: ['bank debit', 'ach', 'mandate', 'authorization', 'financial connections', 'linked bank', 'revoke'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Before you create or join a pod you link a bank account through Stripe and authorize MutualPool to debit it. Deposits are normally taken from your balance; the authorization is the backstop that lets the pod keep going if a balance runs dry.
          </p>
          <p>Under the authorization we may debit your bank account only for:</p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li>a weekly deposit your balance could not cover;</li>
            <li>anything MutualPool advanced on your behalf, such as a hardship advance;</li>
            <li>the remaining deposits you committed to if you leave or are removed from a pod after receiving its payout.</li>
          </ul>
          <p className="text-[11px] text-slate-600">
            We tell you in the app before each debit. You can revoke the authorization by contacting support, but that does not cancel what you owe, and you cannot create or join pods without it.
          </p>
        </div>
      )
    },
    {
      id: 'faq_payout_fee_explained',
      category: 'DEPOSITS_PAYOUTS',
      question: 'What are the platform fees and where does the money go?',
      tags: ['fees', '5%', '10%', '7%', 'service fee', 'cost', 'charges', 'withdrawal fee', 'top up'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            MutualPool charges three fees, and nothing else. There is no interest, no withdrawal fee, and no fee on card top-ups.
          </p>
          <ul className="space-y-2 text-[11px]">
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong>Deposit Fee (5%):</strong> charged on <strong>each weekly deposit</strong> when it is taken. On a $20 deposit, $21 leaves your balance.
            </li>
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong>Payout Fee (10%):</strong> deducted from each rotation payout before it is credited (e.g., $40 on a $400 pot, so the recipient receives $360).
              <div className="mt-1 text-[10px] text-slate-600">
                • <strong>3%</strong> of the pot goes to the member holding the final slot (normally the creator) as the Host Reward.<br />
                • <strong>7%</strong> goes to MutualPool.
              </div>
            </li>
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong>Hardship Repayment Fee (7%):</strong> added to a hardship advance when you repay it. You only pay it if you used a hardship advance.
            </li>
          </ul>
          <p className="text-[11px] text-slate-600">
            Fee changes are announced in the app at least 30 days ahead and apply only to pods that start after the notice period.
          </p>
        </div>
      )
    },
    {
      id: 'faq_payout_execution',
      category: 'DEPOSITS_PAYOUTS',
      question: 'How and when do I receive my lump-sum payout?',
      tags: ['payout', 'withdrawal', 'transfer', 'turn', 'schedule', 'friday', 'bank', '1-3 business days'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Each settlement week runs on a fixed schedule: deposits are taken on <strong>Thursday at 12:00 AM Eastern</strong>, and the week's payout is credited on <strong>Friday at 12:00 AM Eastern</strong>. When it is your turn, the net amount (e.g. <strong>$360.00</strong> on a $400 pot) lands in your <strong>MutualPool balance</strong>.
          </p>
          <p>From your balance you can:</p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
            <li>Withdraw to the bank account you verified with Stripe. There is no withdrawal fee; your bank usually posts it within 1 to 3 business days.</li>
            <li>Leave it in your balance to cover your remaining weekly deposits. Balances do not earn interest.</li>
            <li><strong>Later rotation weeks never wait for a pending bank withdrawal.</strong></li>
          </ul>
          <p className="text-[11px] text-slate-600">
            Recently deposited funds may be held while a card payment is still contestable, and funds subject to a chargeback, refund or fraud review may be held or reversed.
          </p>
        </div>
      )
    },
    {
      id: 'faq_missed_deposit_default',
      category: 'AI_CUSTODIAN_ESCROW',
      question: 'What happens if a member misses a weekly deposit or defaults?',
      tags: ['missed payment', 'default', 'contingency buffer', 'welcome match', 'grace period', 'removal', 'collections', 'owe'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            If the Thursday sweep finds a balance that cannot cover the deposit, here is what happens, in order:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
            <li><strong>Everyone is told.</strong> The missed deposit is recorded, and the member <em>and every other member of the pod</em> get an email and an in-app notice. The member has <strong>24 hours</strong> to pay. A late deposit repays whatever was bridged instead of inflating the pot.</li>
            <li><strong>The week may be bridged.</strong> The pod's contingency buffer (a first pod's Welcome Match, worth one deposit) or MutualPool's escrow may cover the week so Friday's payout still happens. Anything bridged becomes money the member owes.</li>
            <li><strong>24 hours later, still unpaid: removal and restriction.</strong> The member is removed from the pod, and the remaining members vote on whether to list the pod publicly to fill the slot or keep it private. Their account is restricted: no creating or joining pods, no swaps, votes or hardship requests. They can still add funds and pay.</li>
            <li><strong>Collection starts automatically.</strong> Everything owed is debited from their linked bank account under the authorization given when joining, and may also be taken from their balance or future payouts. Money recovered repays escrow, restores the buffer, and bridges the pod's later weeks.</li>
            <li><strong>Paid in full: restored.</strong> Once every default is settled the account is restored automatically.</li>
            <li><strong>A second default in the same pod opens a vote.</strong> The second member is warned, and the members not in default vote to <strong>pause</strong> the pod (no deposits or payouts until the defaults are settled) or to <strong>cover</strong> the missing deposits between them each Thursday. A majority decides; the vote closes after 48 hours, and an undecided vote pauses the pod.</li>
          </ol>
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium">
            ⚠️ A member who takes a payout and then stops depositing still owes every remaining deposit of the cycle, and the amount is pursued. A missed deposit also drops them back to the $1,000 pod size limit until it is settled.
          </div>
          <p className="text-[11px] text-slate-600">
            The buffers and escrow are there to keep payouts on schedule, but they are limited and discretionary. Members ultimately rely on each other, which is why the pod size ladder and early slot rules exist.
          </p>
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
              • That 3% is redirected into the <strong>System Deposits Escrow Account</strong> to backstop future member payouts.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'faq_system_escrow',
      category: 'AI_CUSTODIAN_ESCROW',
      question: 'What is the System Deposits Escrow Account?',
      tags: ['system escrow', 'liquidity', 'advance', 'reserve', 'shortfall', 'bridge'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            The <strong>System Deposits Escrow Account</strong> is a liquidity reserve managed by MutualPool.
          </p>
          <p>
            When a pod's own contingency buffer cannot cover a missed deposit, escrow may bridge the week's deposit (e.g. <strong>$20.00</strong>) so the scheduled payout still goes out. Whatever escrow advances becomes money the missing member owes, and anything later recovered from them repays escrow first.
          </p>
          <p className="text-[11px] text-slate-600">
            Escrow is limited and used at MutualPool's discretion. It is a backstop, not a guarantee that every shortfall caused by another member will be covered.
          </p>
        </div>
      )
    },
    {
      id: 'faq_hardship_relief',
      category: 'AI_CUSTODIAN_ESCROW',
      question: 'What if I experience personal or financial hardship during an active cycle?',
      tags: ['hardship', 'emergency', 'advance', 'accident', 'medical', 'relief', '90 days', 'repay', '7%'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Gig work is unpredictable: breakdowns, accidents and medical emergencies happen. If one lands on a deposit week, you can submit a <strong>Hardship Request</strong> from your pod screen.
          </p>
          <p>
            An approved request means <strong>MutualPool makes that one weekly deposit on your behalf</strong>, so your pod stays on schedule and you keep your standing. It is an advance against your own future payouts, not a loan.
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li>You become eligible after <strong>90 days</strong> of pod membership.</li>
            <li>Requests are reviewed by MutualPool and may be declined. Limits apply per pod and per week (one approved advance per pod per cycle, at most two outstanding per pod).</li>
            <li>The advance must be repaid, plus the <strong>7% hardship repayment fee</strong>, before you can join or create another pod.</li>
          </ul>
          <p className="text-[11px] text-slate-600">
            If a <em>creator</em> enters a hardship hold, Lainie's Autonomous Custodian takes over pod stewardship so the other members are unaffected.
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
            Stripe, which processes every deposit, payout, withdrawal and bank debit on MutualPool, requires verified identity before it will move money for you, in line with federal anti-money-laundering rules.
          </p>
          <p>
            Verification also protects the pod itself: it enforces one account per person, and it means the people you are trusting with weekly deposits are real, authenticated individuals, not duplicate or throwaway accounts.
          </p>
        </div>
      )
    },
    {
      id: 'faq_slot_swap',
      category: 'SECURITY_FDIC',
      question: 'Can members of a pod switch places for an early payout? Can the Pod Creator switch too?',
      tags: ['swap', 'reprioritize', 'vote', 'trade slot', 'early payout', 'creator swap', 'emergency', 'rotation order', 'peer swap'],
      answer: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>Yes.</strong> There are two ways to move up when an unexpected expense hits:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li><strong>Spot swap:</strong> send a proposal to one other member. Once both of you consent in the app, your positions trade and the schedule updates for the whole pod.</li>
            <li><strong>Reprioritization vote:</strong> ask the pod to move you into the next payout slot. If more than half of the members vote yes, you take that slot and the member you displaced moves into your old one.</li>
          </ul>
          <p>
            <strong>Can the Creator switch places too?</strong> Yes, like any other member. But the <strong>3% Host Reward goes with the final slot</strong>: whoever ends up holding it receives the 3% on every later payout.
          </p>
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 font-medium space-y-1">
            <div>⚖️ <strong>Limits:</strong></div>
            <div>• Members who have already received their payout cannot swap.</div>
            <div>• In the early half of the rotation, no swap or vote can put a newer member ahead of a more established one, and in pots over $1,000 every early slot must stay with a member who has completed a pod or has 90+ days on MutualPool.</div>
          </div>
          <p className="text-[11px] text-slate-600">
            Every swap and vote outcome is recorded in the pod's audit log and is binding on all members.
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
            <li><strong>Credited to your MutualPool balance:</strong> Daily earnings are credited to your balance once each shift is verified with AI Vision, ready to withdraw or to cover your weekly pod deposits.</li>
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
            Our multi-modal <strong>AI Vision engine</strong> verifies that the partner gear is properly worn, while GPS tracks active route mileage during campaign hours. Once verified, daily wages are credited to your MutualPool balance.
          </p>
        </div>
      )
    }
  ];
};
