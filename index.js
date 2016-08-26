'use strict';

var pluginName = 'gulp-tojst';
var gulpUtil = require('gulp-util');
var through = require('through');
var assign = require('lodash.assign');
var template = require('lodash.template');

function pluginError (message) {
  return new gulpUtil.PluginError(pluginName, message)
}

function getNamespace (namespace) {
  var output = [];
  var currentPath = 'this';

  if (namespace !== 'this') {
    namespace
      .split('.')
      .forEach(function(part, index) {
        if (part !== 'this') {
          currentPath += '[' + JSON.stringify(part) + ']';
          output.push(currentPath + ' = ' + currentPath + ' || {};');
        }
      });
  }

  return {
    namespace: currentPath,
    declaration: output.join('\n')
  };
}

var defaults = {
  amd: false,
  prettify: false,
  namespace: 'JST',
  processName: function (fileName) {
    return fileName;
  },
  processContent: function (source) {
    return source;
  },
  separator: '\n',
  templateSettings: {}
};

module.exports = function tojst (fileName, settings) {
  if (!fileName) {
    pluginError('Missing fileName.');
  }

  var options = assign({}, defaults, settings || {});
  var files = [];
  var nsInfo;

  function compile (file) {
    var name = options.processName(file.path);
    var contents = template(file.contents.toString(),
      options.templateSettings).source;

    if (options.prettify) {
      contents = contents.replace(/\n/g, '');
    }

    if (options.amd && !options.namespace) {
      return 'return '.concat(contents);
    }

    if (options.namespace) {
      nsInfo = getNamespace(options.namespace);
    }

    return nsInfo.namespace.concat('[', JSON.stringify(name),
      '] = ', contents, ';');
  }

  function write (file) {
    if (file.isNull()) {
      return;
    }
    if (file.isStream()) {
      return this.emit('error', pluginError('Streaming is not supporting.'));
    }

    if (file.isBuffer()) {
      files.push(file);
    }
  }

  function end () {
    var compiled = files.map(compile);

    //if (!compiled.length) {
    //  this.emit('error', pluginError('Destination not written because compiled files were empty.'));
    //} else {
      if(options.namespace !== false) {
        compiled.unshift(nsInfo.declaration);
      }
      if (options.amd) {
        if (options.prettify) {
          compiled.forEach(function(line, index) {
            compiled[index] = '  '.concat(line);
          });
        }
        compiled.unshift('define(function(){');
        if (options.namespace !== false) {
          compiled.push('  return '.concat(nsInfo.namespace, ';'));
        }
        compiled.push('});');
      }

      this.queue(new gulpUtil.File({
        path: fileName,
        contents: new Buffer(compiled.join(options.separator))
      }));
    //}

    this.queue(null);
  }

  return through(write, end);
}
