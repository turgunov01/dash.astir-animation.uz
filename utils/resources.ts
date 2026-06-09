import type { EndpointToolDefinition, ResourceDefinition, ResourceField } from '~/types/api'

const staffRoleOptions = [
  { label: 'Админ', value: 'admin' },
  { label: 'Супер-админ', value: 'super_admin' }
]

const roleOptions = [
  ...staffRoleOptions,
  { label: 'Родитель', value: 'parent' }
]

const statusOptions = [
  { label: 'Активен', value: 'active' },
  { label: 'Неактивен', value: 'inactive' },
  { label: 'Ожидает', value: 'pending' },
  { label: 'Одобрен', value: 'approved' },
  { label: 'Истек', value: 'expired' },
  { label: 'Отменен', value: 'cancelled' },
  { label: 'Льготный период', value: 'grace_period' }
]

const localizedTitleDescription: ResourceField[] = [
  { key: 'title', label: 'Название', type: 'localized', required: true },
  { key: 'description', label: 'Описание', type: 'localized', rows: 4 }
]

const categoryFields: ResourceField[] = [
  ...localizedTitleDescription,
  { key: 'type', label: 'Тип', type: 'text', placeholder: 'cartoon' },
  { key: 'slug', label: 'Slug', type: 'text', placeholder: 'cartoons' },
  { key: 'active', label: 'Активна', type: 'checkbox', defaultValue: true },
  { key: 'icon', label: 'Иконка категории', type: 'file', accept: 'image/*', placeholder: 'Выберите иконку' }
]

const tagFields: ResourceField[] = [
  { key: 'name', label: 'Название', type: 'text', required: true },
  { key: 'slug', label: 'Slug', type: 'text', placeholder: 'cartoons' },
  { key: 'active', label: 'Активен', type: 'checkbox', defaultValue: true }
]

const userFields: ResourceField[] = [
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'name', label: 'Имя', type: 'text' },
  { key: 'password', label: 'Пароль', type: 'password', help: 'Нужен только при создании нового пользователя.' },
  { key: 'role', label: 'Роль', type: 'select', options: roleOptions, defaultValue: 'admin', required: true },
  { key: 'active', label: 'Активен', type: 'checkbox', defaultValue: true }
]

const staffCreateFields: ResourceField[] = [
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'name', label: 'Имя', type: 'text', required: true },
  { key: 'password', label: 'Пароль', type: 'password', required: true },
  {
    key: 'role',
    label: 'Роль',
    type: 'select',
    options: staffRoleOptions,
    defaultValue: 'admin',
    required: true,
    help: 'Родители создаются через регистрацию/OTP flow, этот endpoint создает только staff.'
  }
]

const childrenFields: ResourceField[] = [
  { key: 'name', label: 'Имя ребенка', type: 'text', required: true },
  { key: 'parentId', label: 'ID родителя', type: 'text' },
  { key: 'birthYear', label: 'Год рождения', type: 'number' },
  { key: 'age', label: 'Возраст', type: 'number' },
  { key: 'active', label: 'Активен', type: 'checkbox', defaultValue: true }
]

const permissionFields: ResourceField[] = [
  {
    key: 'mode',
    label: 'Режим',
    type: 'select',
    options: [
      { label: 'Разрешить', value: 'allow' },
      { label: 'Запретить', value: 'deny' },
      { label: 'Ограничить', value: 'limit' }
    ],
    required: true
  },
  { key: 'categoryId', label: 'ID категории', type: 'text' },
  { key: 'contentId', label: 'ID контента', type: 'text' },
  { key: 'watch_from_min', label: 'Можно смотреть с, минуты дня', type: 'number' },
  { key: 'watch_until_min', label: 'Можно смотреть до, минуты дня', type: 'number' },
  { key: 'weekday_mask', label: 'Маска дней недели', type: 'number' },
  { key: 'daily_limit_minutes', label: 'Лимит в день, минут', type: 'number' }
]

const movieCategoryField: ResourceField = {
  key: 'category_id',
  label: 'Категория',
  type: 'select',
  optionsEndpoint: '/v1/content/categories',
  optionsListKey: 'categories',
  optionLabelKey: 'title',
  optionValueKey: 'id',
  nullable: true
}

const movieSeriesField: ResourceField = {
  key: 'series_id',
  label: 'Сериал',
  type: 'select',
  optionsEndpoint: '/api/v1/series',
  optionsListKey: 'series',
  optionLabelKey: 'title',
  optionValueKey: 'id',
  nullable: true
}

const movieFields: ResourceField[] = [
  ...localizedTitleDescription,
  movieCategoryField,
  movieSeriesField,
  { key: 'year', label: 'Год выпуска', type: 'number', placeholder: '2026', nullable: true },
  { key: 'age_rating', label: 'Возрастное ограничение', type: 'number', defaultValue: 0 },
  { key: 'duration_sec', label: 'Длительность, секунд', type: 'number', placeholder: 'auto' },
  { key: 'published', label: 'Опубликовано', type: 'checkbox' },
  { key: 'is_premium', label: 'Премиум', type: 'checkbox' },
  { key: 'source', label: 'Видео', type: 'text', send: false },
  // { key: 'transcode_status', label: 'Статус транскодинга', type: 'text' }
]

const seriesKindOptions = [
  { label: 'Сезоны', value: 'seasons' },
  { label: 'Эпизоды', value: 'episodes' }
]

const seriesFields: ResourceField[] = [
  { key: 'title', label: 'Название', type: 'localized', required: true },
  { key: 'description', label: 'Описание', type: 'localized', rows: 4 },
  { key: 'kind', label: 'Тип сериала', type: 'select', options: seriesKindOptions, defaultValue: 'seasons' },
  { key: 'active', label: 'Активен', type: 'checkbox', defaultValue: true }
]

const tariffFields: ResourceField[] = [
  ...localizedTitleDescription,
  { key: 'price', label: 'Цена', type: 'text', placeholder: '49000.00' },
  { key: 'currency', label: 'Валюта', type: 'text', defaultValue: 'UZS' },
  { key: 'is_default', label: 'Тариф по умолчанию', type: 'checkbox' },
  { key: 'can_watch_premium', label: 'Открывает премиум', type: 'checkbox' }
]

const tariffTools: EndpointToolDefinition[] = [
  {
    title: 'Изменить цену',
    endpoint: '/v1/tariffs/{id}',
    method: 'PATCH',
    fields: [
      { key: 'price', label: 'Цена', type: 'text', required: true, placeholder: '49000.00' },
      { key: 'currency', label: 'Валюта', type: 'text', defaultValue: 'UZS' }
    ]
  }
]

const userPlanSelectField: ResourceField = {
  key: 'plan_id',
  label: 'Тариф',
  type: 'select',
  required: true,
  optionsEndpoint: '/api/v1/plans',
  optionLabelKey: 'name',
  optionValueKey: 'id'
}

const faqFields: ResourceField[] = [
  { key: 'question', label: 'Вопрос', type: 'localized', required: true },
  { key: 'answer', label: 'Ответ', type: 'localized', rows: 5, required: true },
  { key: 'active', label: 'Активен', type: 'checkbox', defaultValue: true },
  { key: 'sortOrder', label: 'Порядок', type: 'number' }
]

const userTools: EndpointToolDefinition[] = [
  {
    title: 'Активировать или деактивировать',
    endpoint: '/api/v1/users/{id}/active',
    method: 'PATCH',
    fields: [{ key: 'active', label: 'Активен', type: 'checkbox', defaultValue: true }]
  },
  {
    title: 'Назначить тариф',
    endpoint: '/api/v1/users/{id}/plan',
    method: 'POST',
    pathParams: ['id'],
    fields: [
      userPlanSelectField,
      { key: 'auto_renew', label: 'Автопродление', type: 'checkbox', defaultValue: true }
    ]
  }
]

const childTools: EndpointToolDefinition[] = [
  {
    title: 'Установить PIN',
    endpoint: '/api/v1/children/{id}/pin',
    method: 'PUT',
    fields: [{ key: 'pin', label: 'PIN', type: 'password', required: true }]
  },
  {
    title: 'Создать правило просмотра',
    endpoint: '/api/v1/children/{id}/permissions',
    method: 'POST',
    fields: permissionFields
  },
  {
    title: 'Инициализировать продление просмотра',
    endpoint: '/api/v1/children/{id}/extend/init',
    method: 'POST'
  },
  {
    title: 'Продлить по PIN',
    endpoint: '/api/v1/children/{id}/extend/pin',
    method: 'POST',
    fields: [
      { key: 'ticket_id', label: 'Ticket ID', type: 'text', required: true },
      { key: 'pin', label: 'PIN', type: 'password', required: true }
    ]
  }
]

export const resourceDefinitions: Record<string, ResourceDefinition> = {
  users: {
    key: 'users',
    title: 'Пользователи',
    description: 'Операторы, супер-админы и родительские аккаунты. Действия с повышенными правами доступны только super_admin.',
    listEndpoint: '/api/v1/users',
    detailEndpoint: '/api/v1/users/{id}',
    createEndpoint: '/api/v1/users',
    updateEndpoint: '/api/v1/users/{id}',
    deleteEndpoint: '/api/v1/users/{id}',
    createRoute: '/users/create',
    detailRoute: '/users',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Имя' },
      { key: 'role', label: 'Роль', kind: 'status' },
      { key: 'active', label: 'Активен', kind: 'boolean' },
      { key: 'tariff.title', label: 'Тариф', kind: 'localized' },
      { key: 'createdAt', label: 'Создан', kind: 'date' },
      { key: 'lastLogin', label: 'Последний вход', kind: 'date' }
    ],
    filters: [
      { key: 'role', label: 'Роль', type: 'select', options: roleOptions },
      {
        key: 'status',
        label: 'Статус',
        type: 'select',
        options: [
          { label: 'Активные', value: 'active' },
          { label: 'Неактивные', value: 'inactive' }
        ]
      }
    ],
    formFields: userFields,
    createFormFields: staffCreateFields,
    related: [
      { title: 'Дети пользователя', endpoint: '/api/v1/users/{id}/children' },
      { title: 'Подписки пользователя', endpoint: '/api/v1/users/{id}/subscriptions' },
      { title: 'Карты пользователя', endpoint: '/api/v1/users/{id}/cards' }
    ],
    tools: userTools
  },
  children: {
    key: 'children',
    title: 'Дети',
    description: 'Профили детей, PIN, устройства, правила просмотра и продление watch time.',
    listEndpoint: '/api/v1/children',
    detailEndpoint: '/api/v1/children/{id}',
    updateEndpoint: '/api/v1/children/{id}',
    deleteEndpoint: '/api/v1/children/{id}',
    detailRoute: '/children',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Имя' },
      { key: 'parent.email', label: 'Родитель' },
      { key: 'age', label: 'Возраст', kind: 'number' },
      { key: 'birthYear', label: 'Год рождения', kind: 'number' },
      { key: 'active', label: 'Активен', kind: 'boolean' },
      { key: 'devicesCount', label: 'Устройств', kind: 'number' },
      { key: 'extended_until', label: 'Продлено до', kind: 'date' },
      { key: 'createdAt', label: 'Создан', kind: 'date' }
    ],
    filters: [
      {
        key: 'status',
        label: 'Статус',
        type: 'select',
        options: [
          { label: 'Активные', value: 'active' },
          { label: 'Неактивные', value: 'inactive' }
        ]
      }
    ],
    formFields: childrenFields,
    related: [
      { title: 'Устройства', endpoint: '/api/v1/children/{id}/devices' },
      { title: 'Правила просмотра', endpoint: '/api/v1/children/{id}/permissions' }
    ],
    tools: childTools
  },
  tvDevices: {
    key: 'tv-devices',
    title: 'TV-устройства',
    description: 'Пары родитель-ребенок-устройство и отзыв доступа.',
    listEndpoint: '/api/v1/tv-devices',
    deleteEndpoint: '/api/v1/tv-devices/{id}',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Название' },
      { key: 'platform', label: 'Платформа' },
      { key: 'parent.email', label: 'Родитель' },
      { key: 'child.name', label: 'Ребенок' },
      { key: 'pairedAt', label: 'Связано', kind: 'date' },
      { key: 'createdAt', label: 'Создано', kind: 'date' }
    ]
  },
  movies: {
    key: 'movies',
    title: 'Фильмы',
    description: 'Современный каталог /v1: метаданные, премиум-флаг, загрузка видео и статусы транскодинга.',
    listEndpoint: '/v1/content/movies',
    detailEndpoint: '/v1/content/movies/{id}',
    createEndpoint: '/v1/content/movies/create',
    updateEndpoint: '/v1/content/movies/{id}',
    updateMethod: 'PATCH',
    deleteEndpoint: '/v1/content/movies/{id}',
    createRoute: '/content/movies/create',
    detailRoute: '/content/movies',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Название', kind: 'localized' },
      { key: 'is_premium', label: 'Премиум', kind: 'premium' },
      { key: 'published', label: 'Опубликовано', kind: 'boolean' },
      { key: 'year', label: 'Год', kind: 'number' },
      { key: 'age_rating', label: 'Возраст', kind: 'number' },
      { key: 'source', label: 'Источник' },
      { key: 'transcode_status', label: 'Транскодинг', kind: 'status' },
      { key: 'duration_sec', label: 'Длительность', kind: 'number' },
      { key: 'createdAt', label: 'Создан', kind: 'date' }
    ],
    filters: [
      {
        key: 'is_premium',
        label: 'Тип',
        type: 'select',
        options: [
          { label: 'Премиум', value: true },
          { label: 'Бесплатные', value: false }
        ]
      }
    ],
    formFields: movieFields,
  },
  categories: {
    key: 'categories',
    title: 'Категории',
    description: 'Локализованные категории современного контента.',
    listEndpoint: '/v1/content/categories',
    detailEndpoint: '/v1/content/categories/{id}',
    createEndpoint: '/v1/content/categories/create',
    updateEndpoint: '/v1/content/categories/{id}',
    updateMethod: 'PATCH',
    deleteEndpoint: '/v1/content/categories/{id}',
    createRoute: '/content/categories/create',
    detailRoute: '/content/categories',
    columns: [
      { key: 'icon', label: 'Иконка', kind: 'image' },
      { key: 'title', label: 'Название', kind: 'localized' },
      { key: 'type', label: 'Тип' },
      { key: 'slug', label: 'Slug' }
    ],
    formFields: categoryFields,
    createSubmit: {
      forceMultipart: true,
      metadataKey: 'metadata',
      metadataFields: ['title', 'description', 'type', 'slug', 'active']
    },
    updateSubmit: {
      forceMultipart: true,
      metadataKey: 'metadata',
      metadataFields: ['title', 'description', 'type', 'slug', 'active']
    }
  },
  tags: {
    key: 'tags',
    title: 'Теги',
    description: 'Теги нового /v1 content API. Используются для привязки к фильмам через tag_ids или free-form tags.',
    listEndpoint: '/v1/content/tags',
    detailEndpoint: '/v1/content/tags/{id}',
    createEndpoint: '/v1/content/tags/create',
    updateEndpoint: '/v1/content/tags/{id}',
    updateMethod: 'PATCH',
    deleteEndpoint: '/v1/content/tags/{id}',
    createRoute: '/content/tags/create',
    detailRoute: '/content/tags',
    columns: [
      { key: 'name', label: 'Название' },
      { key: 'slug', label: 'Slug' },
      { key: 'active', label: 'Активен', kind: 'boolean' }
    ],
    filters: [
      {
        key: 'active',
        label: 'Статус',
        type: 'select',
        options: [
          { label: 'Активные', value: true },
          { label: 'Неактивные', value: false }
        ]
      }
    ],
    formFields: tagFields
  },
  series: {
    key: 'series',
    title: 'Сериалы',
    description: 'Legacy production-style API: series, episodes and posters.',
    listEndpoint: '/api/v1/series',
    detailEndpoint: '/api/v1/series/{id}',
    createEndpoint: '/api/v1/series',
    updateEndpoint: '/api/v1/series/{id}',
    deleteEndpoint: '/api/v1/series/{id}',
    createRoute: '/content/series/create',
    detailRoute: '/content/series',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Название', kind: 'localized' },
      { key: 'kind', label: 'Тип' },
      { key: 'active', label: 'Активен', kind: 'boolean' },
      { key: 'episodesCount', label: 'Эпизодов', kind: 'number' },
      { key: 'createdAt', label: 'Создан', kind: 'date' }
    ],
    formFields: seriesFields,
    related: [{ title: 'Эпизоды', endpoint: '/api/v1/series/{id}/episodes' }]
  },
  tariffs: {
    key: 'tariffs',
    title: 'Тарифы',
    description: 'Free default тариф и premium-доступ к премиальному контенту.',
    listEndpoint: '/v1/tariffs',
    detailEndpoint: '/v1/tariffs/{id}',
    createEndpoint: '/v1/tariffs/create',
    updateEndpoint: '/v1/tariffs/{id}',
    updateMethod: 'PATCH',
    deleteEndpoint: '/v1/tariffs/{id}',
    createRoute: '/tariffs/create',
    detailRoute: '/tariffs',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Название', kind: 'localized' },
      { key: 'price', label: 'Цена' },
      { key: 'currency', label: 'Валюта' },
      { key: 'is_default', label: 'Default', kind: 'boolean' },
      { key: 'can_watch_premium', label: 'Premium', kind: 'boolean' },
      { key: 'createdAt', label: 'Создан', kind: 'date' }
    ],
    formFields: tariffFields,
    tools: tariffTools
  },
  subscriptions: {
    key: 'subscriptions',
    title: 'Подписки',
    description: 'Админский список подписок и статусов Apple/Google/local billing.',
    listEndpoint: '/api/v1/billing/subscriptions',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'parent.email', label: 'Родитель' },
      { key: 'tariff.title', label: 'Тариф', kind: 'localized' },
      { key: 'provider', label: 'Provider' },
      { key: 'status', label: 'Статус', kind: 'status' },
      { key: 'startedAt', label: 'Старт', kind: 'date' },
      { key: 'expiresAt', label: 'До', kind: 'date' }
    ],
    filters: [{ key: 'status', label: 'Статус', type: 'select', options: statusOptions }]
  },
  transactions: {
    key: 'transactions',
    title: 'Транзакции',
    description: 'Платежные операции и статусы биллинга.',
    listEndpoint: '/api/v1/billing/transactions',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'parent.email', label: 'Родитель' },
      { key: 'amount', label: 'Сумма', kind: 'money' },
      { key: 'currency', label: 'Валюта' },
      { key: 'provider', label: 'Provider' },
      { key: 'status', label: 'Статус', kind: 'status' },
      { key: 'createdAt', label: 'Создана', kind: 'date' }
    ],
    filters: [{ key: 'status', label: 'Статус', type: 'select', options: statusOptions }]
  },
  supportChats: {
    key: 'support-chats',
    title: 'Support chats',
    description: 'Админский inbox с открытыми и непрочитанными обращениями.',
    listEndpoint: '/api/v1/admin/support/chats',
    detailEndpoint: '/api/v1/admin/support/chats/{id}',
    detailRoute: '/support/chats',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'user.email', label: 'Пользователь' },
      { key: 'status', label: 'Статус', kind: 'status' },
      { key: 'unreadCount', label: 'Unread', kind: 'number' },
      { key: 'lastMessage', label: 'Последнее сообщение' },
      { key: 'updatedAt', label: 'Обновлен', kind: 'date' }
    ],
    filters: [{ key: 'status', label: 'Статус', type: 'select', options: statusOptions }],
    related: [{ title: 'Сообщения', endpoint: '/api/v1/admin/support/chats/{id}/messages' }],
    tools: [
      {
        title: 'Ответить',
        endpoint: '/api/v1/admin/support/chats/{id}/messages',
        method: 'POST',
        description: 'Текст и изображение отправляются как multipart/form-data.',
        fields: [
          { key: 'body', label: 'Сообщение', type: 'textarea' },
          { key: 'file', label: 'Изображение', type: 'file', accept: 'image/*', placeholder: 'Выберите изображение' }
        ]
      },
      {
        title: 'Отметить прочитанным',
        endpoint: '/api/v1/admin/support/chats/{id}/read',
        method: 'POST'
      }
    ]
  },
  faqs: {
    key: 'faqs',
    title: 'FAQ',
    description: 'Публичный preview и админское управление вопросами.',
    listEndpoint: '/api/v1/admin/faqs',
    detailEndpoint: '/api/v1/admin/faqs/{id}',
    createEndpoint: '/api/v1/admin/faqs',
    updateEndpoint: '/api/v1/admin/faqs/{id}',
    deleteEndpoint: '/api/v1/admin/faqs/{id}',
    createRoute: '/faqs/create',
    detailRoute: '/faqs',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'question', label: 'Вопрос', kind: 'localized' },
      { key: 'active', label: 'Активен', kind: 'boolean' },
      { key: 'sortOrder', label: 'Порядок', kind: 'number' },
      { key: 'updatedAt', label: 'Обновлен', kind: 'date' }
    ],
    formFields: faqFields,
    related: [{ title: 'Публичный preview', endpoint: '/api/v1/faqs' }]
  }
}

export const navigation = [
  { label: 'Дашбоард', to: '/', icon: 'i-lucide-layout-dashboard' },
  {
    label: 'Пользователи',
    icon: 'i-lucide-users',
    children: [
      { label: 'Родители', to: '/users', icon: 'i-lucide-users' },
      { label: 'Дети', to: '/children', icon: 'i-lucide-baby' }
    ]
  },
  {
    label: 'Устройства',
    icon: 'i-lucide-monitor-smartphone',
    children: [
      { label: 'TV устройства', to: '/devices/tv', icon: 'i-lucide-tv' },
      { label: 'Симулятор', to: '/pairing', icon: 'i-lucide-qr-code' }
    ]
  },
  {
    label: 'Контент',
    icon: 'i-lucide-film',
    children: [
      { label: 'Фильмы', to: '/content/movies', icon: 'i-lucide-clapperboard' },
      { label: 'Сериалы', to: '/content/series', icon: 'i-lucide-panels-top-left' },
      { label: 'Категории', to: '/content/categories', icon: 'i-lucide-tags' },
      { label: 'Теги', to: '/content/tags', icon: 'i-lucide-tag' },
      { label: 'Комментарии', to: '/content/comments', icon: 'i-lucide-message-square-text' }
    ]
  },
  { label: 'Тарифы', to: '/tariffs', icon: 'i-lucide-badge-dollar-sign' },
  { label: 'Подписки', to: '/subscriptions', icon: 'i-lucide-refresh-cw' },
  {
    label: 'Платежи',
    icon: 'i-lucide-credit-card',
    children: [
      { label: 'Транзакции', to: '/billing/transactions', icon: 'i-lucide-receipt' },
      { label: 'Интеграции', to: '/billing/checkout-tools', icon: 'i-lucide-wrench' }
    ]
  },
  { label: 'Чаты', to: '/support/chats', icon: 'i-lucide-message-square' },
  { label: 'Отладка API', to: '/debug/api', icon: 'i-lucide-bug' },
  { label: 'FAQs', to: '/faqs', icon: 'i-lucide-circle-help' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' }
]

export const pairingTools: EndpointToolDefinition[] = [
  {
    title: 'Создать pairing session',
    endpoint: '/v1/pairing/sessions',
    method: 'POST',
    fields: [
      { key: 'deviceName', label: 'Device name', type: 'text', required: true },
      { key: 'platform', label: 'Platform', type: 'text', defaultValue: 'tv' }
    ]
  },
  {
    title: 'Проверить pairing session',
    endpoint: '/v1/pairing/sessions/{sessionId}',
    method: 'GET',
    fields: [{ key: 'sessionId', label: 'Session ID', type: 'text', required: true }],
    pathParams: ['sessionId']
  },
  {
    title: 'Одобрить pairing session',
    endpoint: '/v1/pairing/sessions/{sessionId}/approve',
    method: 'POST',
    fields: [
      { key: 'sessionId', label: 'Session ID', type: 'text', required: true },
      { key: 'childId', label: 'Child ID', type: 'text', required: true }
    ],
    pathParams: ['sessionId']
  }
]

export const billingTools: EndpointToolDefinition[] = [
  {
    title: 'Click transaction status',
    endpoint: '/v1/billing/click/transactions/{transactionId}',
    method: 'GET',
    description: 'Проверяет pending / succeeded / canceled / failed по transaction.id из checkout response.',
    fields: [{ key: 'transactionId', label: 'Transaction ID', type: 'text', required: true }],
    pathParams: ['transactionId']
  },
  {
    title: 'Current subscription',
    endpoint: '/v1/billing/subscription/current',
    method: 'GET',
    description: 'Проверяет активную подписку после succeeded transaction.'
  }
]

