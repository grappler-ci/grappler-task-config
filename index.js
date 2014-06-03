/**
 * Module dependencies
 */

var deploy = require('deploy-yml');
var superagent = require('superagent');
var fs = require('fs');
var exists = fs.exists;
var read = fs.readFile;
var parse = require('url').parse;
var format = require('url').format;

var PROPERTIES = [
  'buildpacks',
  'resources',
  'collaborators',
  'drain',
  'regions',
  'labs',
  'env',
  'app',
  'domains',
  'errorPage'
];

module.exports = function(opts) {
  opts = opts || {};
  opts.name = opts.name || '.deploy';

  return function(task, fn) {
    var dir = task.dir;
    if (!dir) return fn();

    var path = dir + '/' + opts.name;
    exists(path, function(e) {
      if (!e) return fn();

      deploy(path)
        .use(resolveFs)
        .use(resolveGithub(opts))
        .fetch(PROPERTIES, function(err, props) {
          if (err) return fn(err);
          zip(task.info, props);
          fn();
        });
    });
  };
};

function zip(info, props) {
  PROPERTIES.forEach(function(prop, i) {
    info[prop] = props[i];
  });
}

function resolveFs(path, fn) {
  read(path, 'utf8', fn);
}

function resolveGithub(opts) {
  var token = opts.githubToken || process.env.GITHUB_TOKEN;
  return function(path, parent, fn) {
    var obj = parse(path);
    if (obj.hostname !== 'github.com') return fn('pass');
    obj.host = obj.hostname = 'api.github.com';
    var parts = obj.pathname.split('/');
    parts.splice(3, 0, 'contents')
    parts.splice(1, 0, 'repos');
    obj.pathname = parts.join('/');
    var url = format(obj);

    superagent
      .get(url)
      .auth(token, 'x-oauth-basic')
      .buffer(true)
      .set('accept', 'application/vnd.github.v3.raw')
      .end(function(err, res) {
        if (err) return fn(err);
        if (res.error) return fn(res.error);
        fn(null, res.text);
      });
  };
}
