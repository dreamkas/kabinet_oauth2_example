const url = require('url');
const request = require('request-promise');

const app = require('express')();
const config = require('../config');

const {
  client_id,
  client_secret,
  home_url,
  kabinet_url,
} = config;

app.use((req, res, next) => {
  /**
   * В реальном приложении здесь происходит
   * инициализация пользовательской сессии,
   * например, по кукам, с запросом в БД и т.д.
   *
   * В нашем примере мы пропускаем этот шаг.
   */

  req.user = {
    id: 1,
    name: 'Василий'
  };

  next();
});

/**
 * Главная страница
 */
app.get('/', (req, res) => {

  if (!req.user) {
    /**
     * В нашем примере эта ветка никогда не выполнится,
     * т.к. пользователь всегда "авторизован"
     */
    res.status(401);
    res.send(`Вы не авторизованы, поэтому не можете увидеть ссылку для авторизации :)`)
    return;
  }

  /**
   * Формируем ссылку на запрос авторизации через Кабинет
   */

  const parsedUrl = url.parse(kabinet_url);

  Object.assign(parsedUrl, {
    pathname: '/api/oauth2/authorize',
    query: {
      client_id,
      redirect_uri: `${home_url}/oauth2/callback`,
      state: 'arbitraryString',
    },
  });

  const authUrl = url.format(parsedUrl);

  res.send(`
    <h1>СуперСервис3000</h1>
    <h2>Привет, ${req.user.name}!</h2>
    <p>
      <a href="${authUrl}">Интеграция с Кабинет Дримкас</a>
    </p>
  `);
});

/**
 * Возврат со стороны кабинета
 * (пользователь подтвердил авторизацию)
 */
app.get('/oauth2/callback', (req, res) => {
  const code = req.query.code;

  if (!code) {
    // Без кода на этот URL не должны переходить
    res.status(403);
    res.send('Хакер!');
    return;
  }

  request({
    url: `${kabinet_url}/api/oauth2/access_token`,
    method: 'POST',
    json: true,
    body: {
      client_id,
      client_secret,
      code,
    },
  })
  .then((response) => {
    const accessToken = response.access_token;

    /**
     * На этом этапе у нас есть пользователь (req.user)
     * и его токен для доступа к сервису (accessToken)
     *
     * Нужно сохранить этот токен для пользователя в базе,
     * чтобы в дальнейшей сервис мог от его имени
     * взаимодействовать с Кабинетом Дримкас.
     */

    // Сделаем запрос к API Кабинета с этим токеном для примера
    request({
      url: `${kabinet_url}/api/products`,
      json: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    .then((products) => {
      res.send(`
        <h1>Интеграция прошла успешно</h1>
        <p style="max-width: 600px">Пользователю "${req.user.name}" был выдан токен:<br>
          <code style="display: inline-block; background-color: #CDF0C0; padding: 12px; margin: 10px 0">${accessToken}</code>
        </p>
        <h2>Вот, для примера, продукты, полученные из Кабинета по этому токену:</h2>
        <p>
          <pre>${JSON.stringify(products, null, 2)}</pre>
        </p>
      `);
    });
  })
  .catch((err) => {
    res.status(500);
    res.send(err.error.message);
  });
});

app.listen(url.parse(home_url).port || 80, () => {
  console.log(`Open ${home_url} in your browser`);
});
