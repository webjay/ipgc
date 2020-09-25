'use strict';

const request = require('request');
const createServer = require('http').createServer;
const urlParse = require('url').parse;

const Port = process.env.PORT || 3000;

function getTokens (user_id) {
  return new Promise((resolve, reject) => {
    const options = {
      url: 'https://ipgc.auth0.com/oauth/token',
      body: {
        client_id: process.env.client_id,
        client_secret: process.env.client_secret,
        audience: 'https://ipgc.auth0.com/api/v2/',
        grant_type: 'client_credentials'
      },
      json: true
    };
    request.post(options, (err, res, body) => {
      if (err) return reject(err);
      const options = {
        url: 'https://ipgc.auth0.com/api/v2/users/' + user_id,
        auth: {
          bearer: body.access_token
        },
        json: true
      };
      request.get(options, (err, res, body) => {
        if (err) return reject(err);
        resolve(body);
      });
    });
  });
}

function handler (req, res) {
  const urlParsed = urlParse(req.url, true);
  if (urlParsed.pathname !== '/') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', process.env.origin);
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'accept, origin, content-type');
  res.setHeader('Access-Control-Max-Age', 86400);
  res.setHeader('Access-Control-Expose-Headers', 'X-Rate-Limit-Remaining');
  switch (req.method) {
    case 'OPTIONS':
      res.end();
      break;
    case 'GET':
      if (
          !urlParsed.query.url ||
          process.env.hostnames.split(',').indexOf(urlParse(urlParsed.query.url).hostname) === -1
      ) {
        res.writeHead(409);
        res.end();
        return;
      }
      getTokens(urlParsed.query.profile_id)
      .then(profile => {
        req.pipe(request.get({
          url: urlParsed.query.url,
          oauth: {
            consumer_key: process.env.consumer,
            consumer_secret: process.env.consumer_secret,
            token: profile.identities[0].access_token,
            token_secret: profile.identities[0].access_token_secret
          },
          json: true
        }).on('response', (response) => {
          delete response.headers['expires'];
          delete response.headers['cache-control'];
          delete response.headers['pragma'];
          delete response.headers['set-cookie'];
          response.headers['cache-control'] = 'private, max-age=3600';
        })).pipe(res);
      })
      .catch(err => {
        res.writeHead(405);
        res.end();
        console.error(err);
      });
      break;
    default:
      res.writeHead(405);
      res.end();
      break;
  }
}

const server = createServer(handler);

server.listen(Port, _ => {
  console.log('HTTP server listening on port', Port);
});

process.on('SIGTERM', _ => server.close());
