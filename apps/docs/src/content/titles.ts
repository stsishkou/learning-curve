// Chapter and part titles in every language. English lives in the contract's catalogue, which hosts read; the
// others are here, typed over every id, so a new chapter cannot ship without them. Page names follow the planner's
// own words in that language (Шкала курсов, Cronograma).
import { type ChapterId, chapterById, type DocsLocale, PARTS, type PartId } from '@lc/docs-contract'

interface Translations {
  ru: string
  es: string
}

const CHAPTER_TITLES: Record<ChapterId, Translations> = {
  scaffold: {
    ru: 'Из пустой папки — приложение на TanStack Start',
    es: 'De una carpeta vacía a una app de TanStack Start',
  },
  'plan-as-code': { ru: 'План — это код', es: 'El plan es código' },
  'first-screen': { ru: 'Первый экран и первый API', es: 'La primera pantalla y la primera API' },
  guardrails: { ru: 'Ограждения: типы, линтер, формат, коммиты', es: 'Barreras: tipos, lint, formato, commits' },
  'tokens-and-themes': { ru: 'Токены и две темы', es: 'Tokens y dos temas' },
  'three-languages': { ru: 'Три языка', es: 'Tres idiomas' },
  'edits-overlay': { ru: 'Правки, которые переживают перегенерацию', es: 'Ediciones que sobreviven a la regeneración' },
  'direct-manipulation': { ru: 'Прямое управление', es: 'Manipulación directa' },
  workspace: { ru: 'Одно приложение становится рабочим пространством', es: 'Una app se convierte en un workspace' },
  packages: { ru: 'Пакеты и направление зависимостей', es: 'Paquetes y la dirección de las dependencias' },
  'build-time-microfrontends': { ru: 'Микрофронтенды на этапе сборки', es: 'Microfrontends en tiempo de compilación' },
  'affected-ci': { ru: 'CI, который проверяет только изменённое', es: 'CI que comprueba solo lo que cambió' },
  'component-stand': { ru: 'Стенд компонентов', es: 'Un banco de componentes' },
  history: { ru: 'Каждое изменение — шаг', es: 'Cada cambio es un paso' },
  'dashboard-module': { ru: 'Третий модуль: страница прогресса', es: 'Un tercer módulo: la página de progreso' },
  'planner-grows': { ru: 'Планировщик растёт', es: 'El planificador crece' },
  'language-models': { ru: 'Разговор с языковыми моделями', es: 'Hablar con modelos de lenguaje' },
  'calendar-sync': { ru: 'Двусторонняя синхронизация календарей', es: 'Sincronización de calendarios en dos sentidos' },
  rebalancing: { ru: 'Перебалансировка целочисленной программой', es: 'Reequilibrar con un programa entero' },
  timeline: { ru: 'Шкала курсов', es: 'El cronograma' },
  'polish-accessibility': { ru: 'Шлифовка — это доступность', es: 'El pulido es accesibilidad' },
  shipping: { ru: 'Выпуск: где может работать планировщик', es: 'Publicarlo: dónde puede ejecutarse el planificador' },
  'module-federation': {
    ru: 'От сборки к выполнению: Module Federation',
    es: 'De la compilación a la ejecución: Module Federation',
  },
  'docs-remote': {
    ru: 'Это руководство как remote: контракт, изоляция, деплой',
    es: 'Esta guía como remote: contrato, aislamiento, despliegue',
  },
}

const PART_TITLES: Record<PartId, Translations> = {
  ground: { ru: 'Фундамент: инструменты, каркас, оболочка', es: 'Cimientos: herramientas, esqueleto, carcasa' },
  structure: {
    ru: 'Первая настоящая функция и структура, которую она потребовала',
    es: 'La primera función real y la estructura que impuso',
  },
  infrastructure: { ru: 'Общая инфраструктура', es: 'Infraestructura compartida' },
  features: { ru: 'Новые возможности', es: 'Más funciones' },
  shipping: { ru: 'Надёжность и выпуск', es: 'Solidez y puesta en marcha' },
  runtime: { ru: 'Микрофронтенды во время выполнения', es: 'Microfrontends en tiempo de ejecución' },
}

export function chapterTitle(id: ChapterId, locale: DocsLocale): string {
  return locale === 'en' ? chapterById(id).title : CHAPTER_TITLES[id][locale]
}

export function partTitle(id: PartId, locale: DocsLocale): string {
  if (locale !== 'en') return PART_TITLES[id][locale]
  return PARTS.find((part) => part.id === id)?.title ?? id
}
