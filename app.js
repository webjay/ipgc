/*global Auth0Lock twttr*/
/* eslint-env browser */

function login () {
  lock.show({
    allowedConnections: ['twitter'],
    allowSignUp: false
  });
}

function logout () {
  localStorage.removeItem('auth0token');
  lock.logout({
    returnTo: window.location.href,
    federated: true
  });
}

function qs (data) {
  return Object.keys(data).map(function (key) {
    if (typeof data[key] === 'object') {
      return qs(data[key]);
    } else {
      return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
    }
  }).join('&');
}

function ajaxGet (url, query, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('get', url + '?' + qs(query), true);
  xhr.setRequestHeader('Content-type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      callback(JSON.parse(xhr.responseText), this.getResponseHeader('X-Rate-Limit-Remaining'));
    }
  };
  xhr.send();
}

function getFriends (profile_id, user_identity, next_cursor) {
  var urlProxy = 'https://ipgc.herokuapp.com/';
  if (next_cursor === undefined) {
    next_cursor = -1;
  }
  var query = {
    count: 200,
    skip_status: true,
    include_user_entities: false,
    user_id: user_identity.user_id,
    cursor: next_cursor
  };
  var params = {
    url: 'https://api.twitter.com/1.1/friends/list.json?' + qs(query),
    profile_id: profile_id
  };
  ajaxGet(urlProxy, params, function (data, RateLimitRemaining) {
    progress.max += data.users.length;
    insertFriends(data.users);
    if (data.next_cursor !== 0 && RateLimitRemaining > 0) {
      getFriends(profile_id, user_identity, data.next_cursor);
    }
  });
}

function insertFriends (users) {
  var docfrag = document.createDocumentFragment();
  users.forEach(insertFriend.bind(null, docfrag));
  document.getElementById('friendset').appendChild(docfrag);
}

function insertFriend (docfrag, user) {
  if (document.getElementById('user' + user.id_str)) {
    return;
  }
  var input = document.createElement('input');
  input.setAttribute('type', 'checkbox');
  input.setAttribute('name', 'user');
  input.setAttribute('data-id', user.id_str);
  input.setAttribute('data-name', user.name);
  input.setAttribute('value', user.screen_name);
  input.setAttribute('class', 'tweep');
  input.setAttribute('form', 'friendlyform');
  var label = document.createElement('label');
  label.appendChild(input);
  label.appendChild(document.createTextNode(' '));
  label.appendChild(document.createTextNode('@' + user.screen_name));
  var div = document.createElement('div');
  div.setAttribute('class', 'checkbox');
  div.appendChild(label);
  var cardBlock = tagster('div', 'card-block');
  cardBlock.appendChild(tagster('h4', 'card-title', user.name));
  cardBlock.appendChild(tagster('p', 'card-text small', user.description));
  var cardForm = tagster('p', 'card-text');
  cardForm.appendChild(div);
  cardBlock.appendChild(cardForm);
  var card = tagster('div', 'card');
  card.setAttribute('id', 'user' + user.id_str);
  card.appendChild(cardBlock);
  docfrag.appendChild(card);
  progress.value++;
}

function tagster (tag, classes, text) {
  var el = document.createElement(tag);
  el.setAttribute('class', classes);
  if (text) {
    el.appendChild(document.createTextNode(text));
  }
  return el;
}

function search (event) {
  event.preventDefault();
  var searchEl = document.getElementById('search');
  var queries = searchEl.value.split(',').map(function (query) {
    return query.trim().toLowerCase();
  });
  var inputs = document.querySelectorAll('input.tweep');
  for (var i = 0, len = inputs.length; i < len; i++) {
    var card = document.getElementById('user' + inputs[i].getAttribute('data-id'));
    var values = [];
    values.push(inputs[i].getAttribute('value').toLowerCase());
    values.push(inputs[i].getAttribute('data-name').toLowerCase());
    // values.push(inputs[i].getAttribute('data-id'));
    var match = false;
    for (var iv = values.length - 1; iv >= 0 && match === false; iv--) {
      for (var iq = queries.length - 1; iq >= 0 && match === false; iq--) {
        if (values[iv].indexOf(queries[iq]) !== -1) {
          match = true;
        }
      }
    }
    if (match === false) {
      inputs[i].checked = false;
      card.hidden = true;
    } else {
      card.hidden = false;
      inputs[i].checked = true;
    }
  }
}

function init (authResult) {
  if (authResult !== undefined) {
    localStorage.setItem('auth0token', authResult.idToken);
  }
  var auth0token = localStorage.getItem('auth0token');
  if (auth0token) {
    document.getElementById('auth').hidden = true;
    document.getElementById('friendlist').hidden = false;
    lock.getProfile(auth0token, function (err, profile) {
      if (err) return console.error(err.message);
      progress.value++;
      var friendset = document.getElementById('friendset');
      while (friendset.firstChild) {
        friendset.removeChild(friendset.firstChild);
      }
      progress.max += profile.user_metadata.twitter_friends.length;
      insertFriends(profile.user_metadata.twitter_friends);
      getFriends(profile.user_id, profile.identities[0]);
      var searchForm = document.getElementById('searchform');
      searchForm.onsubmit = search;
    });
  }
}

function mentions (a) {
  return '@' + [a.slice(0, -1).join(', @'), a.slice(-1)[0]].join(a.length < 2 ? '' : ' and @');
}

function match (event) {
  event.preventDefault();
  var tweetDiv = document.getElementById('tweet');
  while (tweetDiv.firstChild) {
    tweetDiv.removeChild(tweetDiv.firstChild);
  }
  var users = [];
  var inputs = document.querySelectorAll('input.tweep');
  for (var i = 0, len = inputs.length; i < len; i++) {
    if (inputs[i].checked === true && inputs[i].disabled === false) {
      users.push(inputs[i].value);
      // inputs[i].disabled = true;
    }
  }
  var text = mentions(users) + ' should meet for a coffee.';
  twttr.widgets.createShareButton('', tweetDiv, {
    text: text,
    url: 'http://interestingpeoplegettingcoffee.com/',
    hashtags: 'ipgc',
    // via: 'ipgcoffee',
    size: 'large',
    dnt: true
  });
}

var lock = new Auth0Lock('Rpv4DU22WCzDPeU0t9P0SAp14dmKfXNz', 'ipgc.auth0.com');
lock.on('authenticated', init);

var progress = document.getElementsByTagName('progress')[0];

init();
