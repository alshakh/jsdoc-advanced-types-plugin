
# jsdoc-advanced-types-plugin

This is a plugin for `jsdoc` to support advanced vscode/typescript type definitions which are not supported currently.

## The problem :

I use vscode for development, and currently vscode & jsdoc have some conflicts in their syntax for type definitions. This forces me to have a choice, either use jsdoc definitions and have html docs, or use vscode type definitions for vscode autocompleted.

## What this plugin does

This plugin taps into the jsdoc's document generation, and rewrites comment blocks to write it in a jsdoc type definitions, **it does not change your code, only the compiled documents**. So, you can enjoy both benefits.

## Supported type definitions

* arrow function definitions

```
@param {(property : string) => string[]} callback This is a callback
```

will be converted to at the time of generation to

```
@param {function} callback signature `(property : string) => string[]` callback This is a callback
```

* object type definitions

```
@type {{
	a : { b : "asdf" },
	b : string => string
}} 
```

will be converted to jsdoc compliant format

```
@type {object}
@property {object} a
@property {string} a.b
@property {function} b signature `string => string`
```

* it supports following tags `@param`,`@type`,`@property`,`@return`

## Notes

* use with `jsdoc-plugin-typescript` to support `import` statements

other notes :

* rashly implemented, probably full of bugs!
* not very efficient
* BUT, it works for my current work!

