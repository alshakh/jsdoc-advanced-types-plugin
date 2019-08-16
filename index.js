
const getBorders = (str, firstParan) => {
	const o = str.charAt(firstParan);
	const c = o === '{' ? '}' : (o === '(' ? ')' : (o === '[' ? ']' : null))
	if (!c) { throw "invalid open paranthesis" }
	// walk 
	let depth = 1
	let endParan = null
	for (let i = firstParan + 1; i < str.length; i++) {
		switch (str.charAt(i)) {
			case o:
				depth++;
				break;
			case c:
				depth--;
				break;
		}
		if (depth === 0) {
			endParan = i;
			break;
		}
	}
	return endParan
}


/**
 * @param {string} commentstr 
 * @returns {{comment : string, tags : string[]}}
 */
const splitJSDocComment = (commentstr) => {
	commentstr = commentstr.replace(/(?:^\s*\/\*\*\s*|^\s*\*\/)/gm, "") // remove /** */
	commentstr = commentstr.replace(/^\s*\*/gm, "") // remove stars *
	const initialComment = commentstr.split(/^\s*@/m)[0]
	const tags = commentstr.split(/^\s*@/gm).splice(1).map(x => `@${x}`)
	//console.log('tags:', tags)
	return { comment: initialComment, tags: tags }
}

/**
 * takes something like this
 * {sources : {"tt" : { a : { b : string[] }}, "abc" : string[]},lala : string[],amt : (property : string) => ("a"|"b"),equli : object<string,string>,transform : (property : string) => string,untransform : (property : string) => string}
 * and turns it to this 
 * {aaaaaaa : aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,aaaa : aaaaaaaa,aaa : aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,aaaaa : aaaaaaaaaaaaaaaaaaaaa,aaaaaaaaa : aaaaaaaaaaaaaaaaaaaaaaaaaaaaa,aaaaaaaaaaa : aaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
 * 
 * Notice how the mask matches the positions of values exactly. 
 * The pursope is to make parsing easier, by knowing bounds of values. The only purpose is to extract bounds of values.
 */
const maskObjectType = (objTypeStr) => {
	let tmp = objTypeStr.replace(/^\{|\}$/g, "");
	let ctr = 0
	while (true) {
		if (ctr > 100) {
			throw "inifinte loop!" // Bugs happen!
		}
		ctr++;
		//
		let complicated = tmp.match(/{[^{}]*}|\[[^\[\]]*\]|\([^()]*\)|<[^<>]*>|\w+\s*=>\s*\w+|[b-zA-Z0-9]+|"[^"]*"|'[^']*'/g)
		if (!complicated) {
			break;
		}
		for (let s of complicated) {
			tmp = tmp.replace(s, "a".repeat(s.length))
		}
	}
	return "{" + tmp + "}"
}

/**
 * 
 * @param {string} typeString  values inside {} in tag statement
 * @returns {{kind : ("simple"|"arrowfn"|"objectType"), value : any, comment : string}}
 */
const parseType = (typeString) => {
	const trimmed = typeString.trim()

	const simpleTypeRegex = /^(?:\[|\w+|\*)/i
	if (trimmed.match(simpleTypeRegex)) {
		return {
			kind: "simple",
			value: typeString.trim(),
			comment: ""
		}
	}
	//
	const arrowFunctionRegex = /^[^{].*=>.*$/
	if (trimmed.match(arrowFunctionRegex)) {
		return {
			kind: "arrowfn",
			value: "function",
			comment: 'signature `' + trimmed + '`'
		}
	}
	const objectTypeRegex = /^\s*{.*}\s*$/
	if (trimmed.match(objectTypeRegex)) {
		let objType = trimmed.replace(/^\s*\{/, "{").replace(/\}\s*$/, "}")
		let masked = maskObjectType(objType)

		let typeSchema = {}

		let ctr = 0;
		let pointer = 1;
		while (pointer < masked.length) {
			if (ctr++ > 100) {
				throw "infinite loop!"
			}

			let colonPos = masked.indexOf(':', pointer)
			let key = objType.substring(pointer, colonPos).replace(/^\s*"|"\s*$/g, "").trim();
			pointer = colonPos + 1

			let commaOrBracket = masked.indexOf(",", pointer)
			if (commaOrBracket < 0) {
				commaOrBracket = masked.indexOf("}", pointer)
			}

			let value = objType.substring(pointer, commaOrBracket);
			pointer = commaOrBracket + 1
			//console.log(key,'->',value)
			//console.log()
			typeSchema[key] = parseType(value)
		}

		return {
			kind: "objectType",
			value: typeSchema,
			comment: ""
		}
	}

	return {
		kind: "simple",
		value: typeString,
		comment: ""
	}
}
/**
 * 
 * @param {string} tag 
 * @returns {{tagname: tagname,
 *    type: typeinfo,
 *    identifier: identifier,
 *    description: description,
 *    original: tag} | string} 
 */
const parseTag = (tag) => {
	let pointer = 0;
	const tagname = tag.match(/^@\w+/)[0]
	if (!["@property", "@type", "@param"].includes(tagname)) {
		return tag
	}
	tag = tag.replace(/\n/g, " ")

	pointer = tagname.length
	// TODO check if tag has type
	const typeinfo = (() => {
		const start = tag.indexOf("{")
		const end = getBorders(tag, start)
		pointer = end + 1
		let strippedType = tag.substring(start, end + 1).replace(/^\s*\{|\}\s*$/g, "")
		return parseType(strippedType)
	})()
	//
	const identifier = (() => {
		if (tagname !== "@type" && pointer < tag.length) {
			const regex = /^\s*(\[?(\w+)(?:(?:\s*=\s*.+\])|\]?))/ // g1: full idntifier e.g `[a="df"]`, g2: only identifier e.g `a`
			const match = tag.substring(pointer).match(regex)
			if (!match) return {
				full: "",
				only: ""
			}
			pointer += match[1].length + 1
			return {
				full: match[1].trim(),
				only: match[2].trim(),
			}
		} else {
			return {
				full: "",
				only: ""
			}
		}
	})()
	//
	const description = tag.substring(pointer);
	//
	return {
		tagname: tagname,
		type: typeinfo,
		identifier: identifier,
		description: description,
		original: tag
	}
}

const transformTag = (parsedTag) => {
	if (typeof parsedTag === "string") {
		return parsedTag
	} else if (parsedTag.type.kind === "simple") {
		if (parsedTag.originial) {
			return parsedTag.original
		} else {
			return `${parsedTag.tagname} {${parsedTag.type.value}} ${parsedTag.identifier.full || ""} ${parsedTag.description || ""}`
		}
	} else if (parsedTag.type.kind === "arrowfn") {
		const t = parsedTag;
		return `${t.tagname} {${t.type.value}} ${t.identifier.full || ""} ${t.type.comment || ""} ${t.description}`
	} else if (parsedTag.type.kind === "objectType") {
		const t = parsedTag;
		let ret = []
		if (t.tagname === "@type") {
			ret.push(`${t.tagname} {object} ${t.description}`)
			for (let x of Object.keys(t.type.value)) {
				ret.push(transformTag({
					tagname: "@property",
					type: t.type.value[x],
					identifier: {
						full: `${x}`,
						only: `${x}`
					},
					description: ""
				}))
			}
		} else {
			ret.push(`${t.tagname} {object} ${t.identifier.full} ${t.description}`)
			for (let x of Object.keys(t.type.value)) {
				ret.push(transformTag({
					tagname: t.tagname,
					type: t.type.value[x],
					identifier: {
						full: `${t.identifier.only.trim()}.${x}`,
						only: `${t.identifier.only.trim()}.${x}`
					},
					description: ""
				}))
			}
		}
		return ret.join("\n")
	}
}



exports.handlers = {
	jsdocCommentFound: function (e) {

		//console.log("<<", e.comment, ">>")
		let x = splitJSDocComment(e.comment)
		let tgs = x.tags
			.map(t => parseTag(t))
			.map(t => transformTag(t))
			.join("\n");

		let full = `${x.comment}\n${tgs}`.replace(/^/gm, "\t* ");
		full = "/**\n" + full + "\n*/"
		e.comment = full
		//console.log(">>", full, "<<")
	}

};
