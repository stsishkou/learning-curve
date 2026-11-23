// Course content: every item becomes one calendar event when the scheduler gives it a date.
// Edit this file, then run `pnpm run plan` to regenerate packages/plan-data/data/plan.json.
// Descriptions follow the project format: course URL, module URL, 1–3 line goal.
import type { PlanCalendar, QueueItem } from './types'

export const CALENDARS: PlanCalendar[] = [
  { id: 'certs',   name: 'Gemini Certs',                    color: '#2F5BEA', isNew: true,  note: 'Сертификаты Google Partner — приоритет до Нового года' },
  { id: 'hfllm',   name: 'Hugging Face: LLM Cource',        color: '#C98A0B', isNew: false, note: 'Уже существует' },
  { id: 'hfagents',name: 'Hugging Face: AI Agents Course',  color: '#14897A', isNew: false, note: 'Уже существует' },
  { id: 'pypy',    name: 'Practical Python',                color: '#7A5AC8', isNew: true,  note: 'Python для опытного разработчика' },
  { id: 'journey', name: 'AI Journey',                      color: '#7D8796', isNew: false, note: 'Субботний буфер, позже — короткие курсы' },
  { id: 'personal',name: 'Личное',                          color: '#C2456E', isNew: true,  note: 'Спорт, здоровье, семья' },
];

const CPS = 'https://goo.gle/cps';
const AD_PATH = 'https://partner.skills.google/paths/3581';
const AD_EVAL = 'https://partner.skills.google/paths/4306';
const DEP_PATH = 'https://partner.skills.google/paths/3575';
const DEP_GOV = 'https://partner.skills.google/paths/3810';
const GUIDES = 'https://github.com/mrKindly/gemini-cert-guide';

const d = (course: string, module: string, goal: string) => [course && `Course: ${course}`, module && `Module: ${module}`, goal].filter(Boolean).join('\n');

// ---------- Cert 1: Gemini Enterprise Agent Development (~27.5 h full path per course reviews) ----------
const AD = 'GE Agent Dev';
function series(prefix: string, topic: string, n: number, course: string, module: string, goals: string | string[]): QueueItem[] {
  return Array.from({ length: n }, (_, i): QueueItem => ({
    title: `${prefix} — ${topic}${n > 1 ? ` (${i + 1}/${n})` : ''}`,
    hours: 1, kind: 'study',
    description: d(course, module, Array.isArray(goals) ? (goals[i] ?? '') : goals),
  }));
}
export const CERT1: QueueItem[] = [
  ...series(AD, 'Старт: доступ и обзор', 1, CPS, AD_PATH,
    'Войти в Google Skills for Partners рабочим аккаунтом партнёра, записаться на путь Agent Development через goo.gle/cps, пролистать все модули и три challenge-лабы.\nDone: доступ есть, список модулей с реальными часами сверён с этим планом.'),
  ...series(AD, 'Gemini Enterprise и Agent Platform', 1, CPS, AD_PATH,
    'Что такое Gemini Enterprise и Gemini Enterprise Agent Platform (бывш. Vertex AI), где в них живут агенты, что нужно для лаб.\nDone: схема компонентов в заметках.'),
  ...series(AD, 'ADK: агенты, инструменты, runner', 3, CPS, AD_PATH,
    ['Agent Development Kit: LlmAgent, инструкции, модель, runner, локальный запуск.\nDone: первый агент на ADK отвечает локально.',
     'Инструменты: function tools, встроенные tools, вызов внешнего API.\nDone: агент вызывает свой tool с внешним API.',
     'Workflow-агенты и мультиагентность в ADK (sequential, parallel, loop, sub-agents).\nDone: двухагентная цепочка работает.']),
  ...series(AD, 'Интеграции: MCP и A2A', 3, CPS, AD_PATH,
    ['MCP: подключение MCP-сервера как toolset к агенту ADK.\nDone: агент пользуется инструментами MCP-сервера.',
     'A2A: агент как сервис для другого агента, agent card.\nDone: два агента общаются через A2A.',
     'Интеграции с API и данными предприятия, ошибки и ретраи.\nDone: заметка «как подключать внешние системы».']),
  ...series(AD, 'Сессии и память', 2, CPS, AD_PATH,
    ['Session, State, Events в ADK; что хранится между ходами.\nDone: агент помнит контекст в рамках сессии.',
     'Долгосрочная память (Memory Bank / memory service), когда она нужна.\nDone: агент вспоминает факт из прошлой сессии.']),
  ...series(AD, 'Промпты и настройка', 1, CPS, AD_PATH,
    'Prompt design для агентов; tuning и параметры генерации — когда тюнить модель, а когда промпт.\nDone: инструкция агента переписана и сравнена до/после.'),
  ...series(AD, 'Antigravity и coding-агенты', 2, CPS, AD_PATH,
    ['Antigravity: рабочее пространство, агентные задачи, skills.\nDone: сгенерирован и запущен небольшой проект через Antigravity.',
     'Разбор гайда к лабе «Accelerate Development with Antigravity» (неофициальный).\nDone: шаги лабы понятны, таймер можно запускать.']),
  { title: `${AD} — Лаба 1: Accelerate Development with Antigravity`, hours: 2, kind: 'lab',
    description: d(CPS, `${GUIDES}/blob/develop/gemini-enterprise-agent-development/01-accelerate-development-antigravity.md`,
      'Challenge lab ~1,5 ч; таймер не ставится на паузу — запускать только с запасом времени.\nDone: skill badge получен.') },
  ...series(AD, 'Деплой агентов ADK', 3, CPS, AD_PATH,
    ['Варианты деплоя: Agent Engine, Cloud Run; упаковка агента.\nDone: понятен путь от локального агента до продакшна.',
     'Деплой своего агента, проверка через API.\nDone: агент задеплоен и отвечает.',
     'Разбор гайда к лабе «Deploy an Agent with ADK».\nDone: шаги лабы понятны.']),
  { title: `${AD} — Лаба 2: Deploy an Agent with ADK`, hours: 2, kind: 'lab',
    description: d(CPS, `${GUIDES}/blob/develop/gemini-enterprise-agent-development/02-deploy-agent-adk.md`,
      'Challenge lab ~1,5 ч, без паузы.\nDone: skill badge получен.') },
  ...series(AD, 'Оценка агентов и hill climbing', 3, CPS, AD_EVAL,
    ['Путь «Agent Evaluation and Hill Climbing»: базовые метрики, eval-наборы.\nDone: eval-набор из 10 кейсов для своего агента.',
     'Итеративные улучшения и оптимизация стоимости.\nDone: метрика выросла, изменение зафиксировано.',
     'Разбор гайда к лабе «Evaluate and Improve ADK Agents».\nDone: шаги лабы понятны.']),
  ...series(AD, 'Governance агентных экосистем', 1, CPS, AD_PATH,
    'Управление и безопасность агентов: идентичность, политики, наблюдаемость.\nDone: чек-лист governance в заметках.'),
  { title: `${AD} — Лаба 3: Evaluate and Improve ADK Agents`, hours: 2, kind: 'lab',
    description: d(CPS, `${GUIDES}/blob/develop/gemini-enterprise-agent-development/03-evaluate-improve-adk-agents.md`,
      'Challenge lab ~1,5 ч, без паузы. После трёх бейджей забрать сертификат в Credly.\nDone: сертификат Gemini Enterprise Agent Development получен.') },
];

// ---------- Cert 2: Gemini Enterprise Deployment (learning hours are an estimate) ----------
const DP = 'GE Deployment';
export const CERT2: QueueItem[] = [
  ...series(DP, 'Введение в Gemini Enterprise', 2, CPS, DEP_PATH,
    ['Курс «Introduction to Gemini Enterprise», часть 1: продукт, редакции, архитектура.\nDone: заметки по редакциям и компонентам.',
     'Часть 2 и вводная лаба курса.\nDone: вводная лаба пройдена.']),
  ...series(DP, 'Идентичность и доступ', 2, CPS, DEP_PATH,
    ['Identity providers, SSO, роли и права пользователей.\nDone: схема настройки IdP в заметках.',
     'Доступ к данным и приложению, принцип наименьших прав.\nDone: чек-лист прав для внедрения.']),
  ...series(DP, 'Хранилища данных и коннекторы', 2, CPS, DEP_PATH,
    ['Data stores и коннекторы: какие источники, как индексируются.\nDone: подключён тестовый источник.',
     'Workspace как источник данных, права на документы, ответы с источниками.\nDone: поиск по Workspace-данным работает, 5 запросов проверены.']),
  ...series(DP, 'Model Armor и защита приложения', 2, CPS, DEP_PATH,
    ['Model Armor: фильтры промптов и ответов, шаблоны политик.\nDone: политика Model Armor настроена.',
     'Разбор гайда к лабе «Deploy Gemini Enterprise with Workspace Data Sources and Model Armor».\nDone: шаги лабы понятны.']),
  { title: `${DP} — Лаба 1: Deploy Gemini Enterprise with Workspace Data Sources and Model Armor`, hours: 2, kind: 'lab',
    description: d(CPS, `${GUIDES}/blob/develop/gemini-enterprise-deployment/01-deploy-gemini-enterprise.md`,
      'Challenge lab ~1,5 ч, без паузы.\nDone: skill badge получен.') },
  ...series(DP, 'Агенты в Gemini Enterprise', 3, CPS, DEP_PATH,
    ['Подключение существующих агентов (ADK, A2A) к Gemini Enterprise.\nDone: свой агент из первого сертификата виден в Gemini Enterprise.',
     'No-code агенты в Agent Designer.\nDone: no-code агент собран и протестирован.',
     'Разбор гайда к лабе «Add Agents to Gemini Enterprise».\nDone: шаги лабы понятны.']),
  { title: `${DP} — Лаба 2: Add Agents to Gemini Enterprise`, hours: 2, kind: 'lab',
    description: d(CPS, `${GUIDES}/blob/develop/gemini-enterprise-deployment/02-add-agents.md`,
      'Challenge lab ~1,5 ч, без паузы.\nDone: skill badge получен.') },
  ...series(DP, 'Governance: Govern, Secure, and Scale', 3, CPS, DEP_GOV,
    ['Agent Identity и Agent Registry.\nDone: заметки по реестру и идентичности агентов.',
     'Agent Gateways и политики для трафика к агентам и MCP-серверам.\nDone: политика доступа настроена в песочнице.',
     'Разбор гайда к лабе «Govern Agent Access with Gemini Enterprise Agent Platform».\nDone: шаги лабы понятны.']),
  { title: `${DP} — Лаба 3: Govern Agent Access with Gemini Enterprise Agent Platform`, hours: 2, kind: 'lab',
    description: d(CPS, `${GUIDES}/blob/develop/gemini-enterprise-deployment/03-govern-agent-access.md`,
      'Challenge lab ~1,5 ч, без паузы. После трёх бейджей забрать сертификат в Credly.\nDone: сертификат Gemini Enterprise Deployment получен.') },
];

// ---------- HF LLM remainder (Nov 16–20 sessions assumed done) ----------
const LLM = 'https://huggingface.co/learn/llm-course/chapter1/1';
const L = (title: string, mod: string, done: string): QueueItem => ({ title: `HF LLM — ${title}`, hours: 1, kind: 'study',
  description: d(LLM, `https://huggingface.co/learn/llm-course/${mod}`, `Done: ${done}`) });
export const HFLLM: QueueItem[] = [
  L('Ch 2: Using Transformers (2/4)', 'chapter2/3', 'модель загружена, сохранена и перезагружена; предложение токенизировано и раскодировано вручную.'),
  L('Ch 2: Using Transformers (3/4)', 'chapter2/5', 'батч из 3 предложений разной длины с масками, результаты совпадают с одиночными прогонами.'),
  L('Ch 2: Using Transformers (4/4)', 'chapter2/7', 'квиз пройден; сравнение TGI, vLLM и llama.cpp на одну страницу.'),
  L('Ch 3: Fine-tuning (1/4)', 'chapter3/1', 'токенизированный MRPC с рабочим collator, один батч разобран.'),
  L('Ch 3: Fine-tuning (2/4)', 'chapter3/3', 'модель дообучена на MRPC (Colab GPU), accuracy/F1 до и после записаны.'),
  L('Ch 3: Fine-tuning (3/4)', 'chapter3/4', 'ручной цикл PyTorch повторяет метрики Trainer; версия на Accelerate запускается.'),
  L('Ch 3: Fine-tuning (4/4)', 'chapter3/5', 'квиз пройден; кривые обучения MRPC размечены с диагнозом.'),
  L('Ch 4: Sharing models (1/2)', 'chapter4/1', 'модель из Ch 3 запушена в Hub и загружена оттуда.'),
  L('Ch 4: Sharing models (2/2)', 'chapter4/4', 'квиз пройден; model card опубликована.'),
  L('Ch 5: Datasets library (1/4)', 'chapter5/1', 'свой корпус заметок загружен как Dataset со сплитом train/test.'),
  L('Ch 5: Datasets library (2/4)', 'chapter5/3', 'корпус очищен и нарезан через Dataset.map, сохранён на диск.'),
  L('Ch 5: Datasets library (3/4)', 'chapter5/4', 'стриминговый датасет пройден без скачивания; свой датасет запушен в Hub.'),
  L('Ch 5: Datasets library (4/4)', 'chapter5/6', 'квиз пройден; FAISS-индекс по своим чанкам, recall сравнён с RAG v0.'),
  L('Ch 6: Tokenizers (1/3)', 'chapter6/1', 'токенизатор обучен на корпусе заметок; offsets сопоставлены с исходным текстом.'),
  L('Ch 6: Tokenizers (2/3)', 'chapter6/4', 'один абзац RU+EN токенизирован BPE и WordPiece, разница объяснена.'),
  L('Ch 6: Tokenizers (3/3)', 'chapter6/8', 'квиз пройден; токенизатор в стиле WordPiece собран из компонентов.'),
  L('Ch 7: Classical NLP tasks (1/5)', 'chapter7/1', 'NER-модель дообучена на CoNLL, проверена на своей wiki-странице.'),
  L('Ch 7: Classical NLP tasks (2/5)', 'chapter7/3', 'DistilBERT адаптирован на корпусе; perplexity до и после.'),
  L('Ch 7: Classical NLP tasks (3/5)', 'chapter7/4', 'ноутбук перевода или суммаризации прогнан, метрика сравнена с базовой.'),
  L('Ch 7: Classical NLP tasks (4/5)', 'chapter7/6', 'маленькая модель обучена несколько сотен шагов; кривая и стоимость записаны.'),
  L('Ch 7: Classical NLP tasks (5/5)', 'chapter7/7', 'квиз пройден; QA-пайплайн сравнён с генерацией на чанке RAG.'),
  L('Ch 8: Asking for help', 'chapter8/1', 'квиз пройден; свой чек-лист отладки обучения.'),
  L('Ch 9: Demos with Gradio (1/3)', 'chapter9/1', 'Gradio UI поверх своего RAG /ask работает локально.'),
  L('Ch 9: Demos with Gradio (2/3)', 'chapter9/4', 'демо задеплоено как Space; потоковый вывод работает.'),
  L('Ch 9: Demos with Gradio (3/3)', 'chapter9/7', 'квиз пройден; RAG-демо на Blocks с панелью источников.'),
  L('Ch 10: Curating datasets (1/3)', 'chapter10/1', 'Argilla Space запущен и доступен из ноутбука.'),
  L('Ch 10: Curating datasets (2/3)', 'chapter10/3', '30 eval-вопросов размечены PASS/FAIL в Argilla.'),
  L('Ch 10: Curating datasets (3/3)', 'chapter10/5', 'квиз пройден; размеченный eval-набор экспортирован и используется.'),
  L('Ch 11: Fine-tune LLMs (1/3)', 'chapter11/1', 'один диалог прогнан через chat templates двух моделей, разница видна.'),
  L('Ch 11: Fine-tune LLMs (2/3)', 'chapter11/3', 'ноутбук SFT + LoRA прогнан на маленькой модели; время и стоимость записаны.'),
  L('Ch 11: Fine-tune LLMs (3/3)', 'chapter11/5', 'квиз пройден; абзац «когда тюнить, а когда нет».'),
  L('Ch 12: Reasoning models (1/3)', 'chapter12/1', 'заметки: reasoning-модель против чат-модели по цене, задержке и задачам.'),
  L('Ch 12: Reasoning models (2/3)', 'chapter12/3', 'пайплайн R1 в 5 блоках; reward-функция для простой задачи.'),
  L('Ch 12: Reasoning models (3/3)', 'chapter12/5', 'квиз пройден; глава 12 завершена.'),
  L('Course Events + wrap-up', 'events/1', 'курс завершён; ретро на одну страницу.'),
];

// ---------- HF Agents (all 26) ----------
const AG = 'https://huggingface.co/learn/agents-course/unit0/introduction';
const A = (title: string, mod: string, done: string): QueueItem => ({ title: `HF Agents — ${title}`, hours: 1, kind: 'study',
  description: d(AG, `https://huggingface.co/learn/agents-course/en/${mod}`, `Done: ${done}`) });
export const HFAGENTS: QueueItem[] = [
  A('Unit 0: Onboarding', 'unit0/onboarding', 'аккаунт HF и токен готовы, запись на курс.'),
  A('Unit 1: Intro to Agents (1/4)', 'unit1/what-are-agents', 'Quick Quiz 1 пройден.'),
  A('Unit 1: Intro to Agents (2/4)', 'unit1/tools', 'Quick Quiz 2 пройден.'),
  A('Unit 1: Intro to Agents (3/4)', 'unit1/dummy-agent-library', 'ноутбук dummy agent прогнан целиком.'),
  A('Unit 1: Intro to Agents (4/4)', 'unit1/final-quiz', 'финальный квиз Unit 1, сертификат Fundamentals.'),
  A('Unit 2.1: smolagents (1/4)', 'unit2/introduction', 'Quick Quiz 1; первый CodeAgent.'),
  A('Unit 2.1: smolagents (2/4)', 'unit2/smolagents/tool_calling_agents', 'Quick Quiz 2; свой tool.'),
  A('Unit 2.1: smolagents (3/4)', 'unit2/smolagents/multi_agent_systems', 'мультиагентный ноутбук прогнан.'),
  A('Unit 2.1: smolagents (4/4)', 'unit2/smolagents/final_quiz', 'финальный квиз smolagents.'),
  A('Unit 2.2: LlamaIndex (1/3)', 'unit2/llama-index/introduction', 'свои документы проиндексированы и запрошены.'),
  A('Unit 2.2: LlamaIndex (2/3)', 'unit2/llama-index/introduction', 'ноутбуки tools и agents; query engine как tool агента.'),
  A('Unit 2.2: LlamaIndex (3/3)', 'unit2/llama-index/introduction', 'workflow-ноутбук; квиз LlamaIndex.'),
  A('Unit 2.3: LangGraph (1/3)', 'unit2/langgraph/introduction', 'первый граф скомпилирован и запущен.'),
  A('Unit 2.3: LangGraph (2/3)', 'unit2/langgraph/introduction', 'граф сортировки почты с дополнительной веткой.'),
  A('Unit 2.3: LangGraph (3/3)', 'unit2/langgraph/introduction', 'граф анализа документов; квиз LangGraph.'),
  A('Unit 3: Agentic RAG (1/3)', 'unit3/agentic-rag/introduction', 'retriever-tool построен и вызывается агентом.'),
  A('Unit 3: Agentic RAG (2/3)', 'unit3/agentic-rag/introduction', 'три внешних tool зарегистрированы и проверены.'),
  A('Unit 3: Agentic RAG (3/3)', 'unit3/agentic-rag/introduction', 'агент отвечает на многошаговый вопрос; Unit 3 завершён.'),
  A('Unit 4: Final project (1/6)', 'unit4/introduction', 'шаблонный Space скопирован; 5 вопросов GAIA разобраны.'),
  A('Unit 4: Final project (2/6)', 'unit4/introduction', 'архитектура агента; скелет отвечает на 1 вопрос.'),
  A('Unit 4: Final project (3/6)', 'unit4/introduction', 'все tools протестированы; 5 вопросов end-to-end.'),
  A('Unit 4: Final project (4/6)', 'unit4/introduction', 'первый полный прогон отправлен; таблица ошибок.'),
  A('Unit 4: Final project (5/6)', 'unit4/introduction', 'второй прогон, рост оценки записан.'),
  A('Unit 4: Final project (6/6)', 'unit4/introduction', '≥30% в лидерборде, сертификат Completion.'),
  A('Bonus 2: Observability & Evaluation (1/2)', 'bonus-unit2/introduction', 'агент из Unit 4 инструментирован, трейс разобран.'),
  A('Bonus 2: Observability & Evaluation (2/2)', 'bonus-unit2/introduction', 'офлайн-оценка на 10 примерах; курс завершён.'),
];

// ---------- Practical Python (Beazley), ~30 h ----------
const PP = 'https://dabeaz-course.github.io/practical-python';
const PPSECTIONS: [string, number, string][] = [
  ['1. Introduction to Python', 4, 'Числа, строки, списки, файлы, функции; упражнения раздела.'],
  ['2. Working with Data', 5, 'Типы и структуры данных, контейнеры, форматирование, collections, comprehensions, объектная модель.'],
  ['3. Program Organization', 4, 'Скрипты, функции, обработка ошибок, модули, main-модуль.'],
  ['4. Classes and Objects', 4, 'Классы, наследование, специальные методы, свои исключения.'],
  ['5. Inner Workings of Python Objects', 2, 'Словари изнутри, инкапсуляция.'],
  ['6. Generators', 3, 'Протокол итерации, генераторы, producer/consumer, генераторные выражения.'],
  ['7. A Few Advanced Topics', 4, 'Переменное число аргументов, lambda, замыкания, декораторы, static/class methods.'],
  ['8. Testing, Logging, and Debugging', 2, 'unittest/pytest, logging, отладка.'],
  ['9. Packages', 2, 'Пакеты, сторонние модули, публикация своего кода.'],
];
export const PRACTICALPY: QueueItem[] = PPSECTIONS.flatMap(([name, n, goal]) =>
  Array.from({ length: n }, (_, i): QueueItem => ({
    title: `Practical Python — ${name}${n > 1 ? ` (${i + 1}/${n})` : ''}`, hours: 1, kind: 'study',
    description: d(PP, `${PP} (раздел ${name})`, `${goal}\nDone: упражнения этой части решены и закоммичены.`),
  })));
