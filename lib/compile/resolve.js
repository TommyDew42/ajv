'use strict';

var url = require('url')
  , equal = require('./equal');

module.exports = resolve;

resolve.normalizeId = normalizeId;
resolve.fullPath = getFullPath;
resolve.url = resolveUrl;
resolve.ids = resolveIds;
resolve.missing = resolveMissing;


function resolve(compile, rootSchema, ref) {
  var refVal = this._refs[ref];
  if (typeof refVal == 'string') refVal = this._refs[refVal];
  if (typeof refVal == 'function') return refVal;
  var refVal = this._schemas[ref];
  if (typeof refVal == 'function') return refVal;
  var schema = _resolve.call(this, rootSchema, ref);
  if (schema) return this._refs[ref] = compile.call(this, schema, rootSchema);
};


function _resolve(rootSchema, ref) {
  var p = url.parse(ref, false, true)
    , refPath = _getFullPath(p)
    , baseId = getFullPath(rootSchema.id);
  if (refPath !== baseId) {
    // rootSchema = undefined; TODO this breaks resolution in meta-schema
    var refVal = this._refs[refPath];
    if (typeof refVal == 'string') refVal = this._refs[refVal];
    if (typeof refVal == 'function') rootSchema = refVal.schema;
    else {
      var refVal = this._schemas[normalizeId(refPath)];
      if (typeof refVal == 'function') rootSchema = refVal.schema;
    }
    if (!rootSchema) return;
    baseId = getFullPath(rootSchema.id);
  }
  p.hash = p.hash || '';
  if (p.hash.slice(0,2) != '#/') return;
  var parts = p.hash.split('/');
  var schema = rootSchema;

  for (var i = 1; i < parts.length; i++) {
    var part = parts[i];
    if (part) {
      part = unescapeFragment(part);
      schema = schema[part];
      if (!schema) break;
      if (schema.id) baseId = resolveUrl(baseId, schema.id);
      if (schema.$ref) {
        var $ref = resolveUrl(baseId, schema.$ref);
        schema = _resolve.call(this, rootSchema, $ref);
      }
    }
  }
  if (schema != rootSchema) return schema;
}


function unescapeFragment(str) {
  return decodeURIComponent(str)
          .replace(/~1/g, '/')
          .replace(/~0/g, '~');
}


function escapeFragment(str) {
  var str = str.replace(/~/g, '~0').replace(/\//g, '~1');
  return encodeURIComponent(str);
}


function getFullPath(id, normalize) {
  if (normalize !== false) id = normalizeId(id);
  var p = url.parse(id, false, true);
  return _getFullPath(p);
}


function _getFullPath(p) {
  return (p.protocol||'') + (p.protocol?'//':'') + (p.host||'') + (p.path||'')  + '#';
}


var TRAILING_SLASH_HASH = /#\/?$/;
function normalizeId(id) {
    return id ? id.replace(TRAILING_SLASH_HASH, '') : '';
}


function resolveUrl(baseId, id) {
  id = normalizeId(id);
  return url.resolve(baseId, id);
}


function resolveIds(schema) {
  var id = normalizeId(schema.id);
  _resolveIds.call(this, schema, getFullPath(id, false), id);
}


function _resolveIds(schema, fullPath, baseId) {
  if (Array.isArray(schema))
    for (var i=0; i<schema.length; i++)
      _resolveIds.call(this, schema[i], fullPath+'/'+i, baseId);
  else if (schema && typeof schema == 'object') {
    if (typeof schema.id == 'string') {
      var id = baseId = baseId
                        ? url.resolve(baseId, schema.id)
                        : getFullPath(schema.id);

      var refVal = this._refs[id];
      if (typeof refVal == 'string') refVal = this._refs[refVal];
      if (refVal && refVal.schema) {
        if (!equal(schema, refVal.schema))
          throw new Error('id "' + id + '" resolves to more than one schema');
      } else if (id != normalizeId(fullPath))
          this._refs[id] = fullPath;

      // TODO check and resolve missing

    }
    for (var key in schema)
      _resolveIds.call(this, schema[key], fullPath+'/'+escapeFragment(key), baseId);
  }
}


function resolveMissing(schema, schemaRef) {

}