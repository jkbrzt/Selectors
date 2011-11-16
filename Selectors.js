/**
 * JavaScript implementation of CSS3 selectors
 * @see <http://www.w3.org/TR/css3-selectors/>
 * @see <http://blog.webkitchen.cz/css3-selectors-in-javascript>
 *
 * @author Jakub Roztocil <jakub@roztocil.name>
 *
 * Usage:
 *
 *   var divs = Selectors.matchAll('table[summary^="Price List"] ~ div > div');
 *   var scriptsInBody = Selectors.matchAll('script', document.body);
 *
 * :mode=javascript:encoding=utf-8::folding=explicit:collapseFolds=1:
 */

//{{{ Selectors{}

var Selectors = {

  WHITESPACE: /\s/,
  dumpResult: false,

  //{{{ public matchAll()
  /**
   * @param String selectorsGroupString
   * @return Array<Element>
   */
  matchAll: function(selectorsGroupString, root) {
    //try {
      var elements = [];
      var selectors = Selectors.parse(selectorsGroupString);
      for (var i = 0; i < selectors.length; i++) {
        elements = elements.concat(selectors[i].findElements(root || document));
      }
      if (Selectors.dumpResult) {
        Selectors.dump(selectorsGroupString, selectors, elements);
      }
      //if (selectors.length > 1) {
        elements = Selectors.unique(elements);
      //}
      return elements;
    //} catch (E) {
      //alert(E);
      return [];
    //}
  },
  //}}}

  //{{{ parse()
  /**
   * @param String selectorsGroupString - one or more comma separated selectors
   * @return Array<Selectors.Selector>
   */
  parse: function(selectorsGroupString) {

    selectorsGroupString = selectorsGroupString.replace(/^\s+/, '').replace(/\s+$/, '');

    var ch, // current character
      pos = 0, // current position
      skipWhitespace = 0, // position of next non-white-space character
      len = selectorsGroupString.length,
      selectors = [],
      selector = new Selectors.Selector(), // Selector.SimpleSelector, Selectors.Combinator, ...
      ss = new Selectors.SimpleSelector(),
      openQuote = null,
      negation = null,
      escaped = false,
      UNICODE = /^[0-9a-f]{1,6}/i;

    selectors.push(selector);

    var states = {

      type: true,
      clazz: false,
      id: false,
      attr: false,
      attrName: false,
      attrValue: false,
      pc: false,   // pseudo-class
      pcName: false, // pseudo-class name
      pcArg: false,  // pseudo-class argument
      not: false,

      allFalse: function() {
        for (var i in this) {
          if (i != 'allFalse' && i != 'not') {
            this[i] = false;
          }
        }
      }

    }

    for (;;) {

      if (pos > len) {
        break;
      }

      escaped = false;
      ch = selectorsGroupString.charAt(pos);
      skipWhitespace = Selectors.eatWhitespaces(selectorsGroupString, pos);

      //{{{ backslash
      if (ch == '\\') {
        ++pos;
        escaped = true;
        var hexaCode = selectorsGroupString.substr(pos, 6).match(UNICODE);
        if (hexaCode != null) {
          hexaCode = hexaCode[0];
          ch = String.fromCharCode(parseInt(hexaCode, 16));
          pos += hexaCode.length - 1;
        } else {
          ch = selectorsGroupString.charAt(pos);
        }
      } //}}}

      //{{{ atribute selector
      if (states.attr) {

        //{{{ attribute selector name
        if (states.attrName) {
          switch (ch) {
            case '=':
              ss.getLastAttributeSelelector().match += ch;
              states.attrName = false;
              states.attrValue = true;
              pos = skipWhitespace;
              break;
            case '~':
            case '|':
            case '^':
            case '$':
            case '*':
              if (selectorsGroupString.charAt(pos + 1) != '=') {
                // TODO: namespaces are not supported - throw an specific error if the char is '|'
                throw new Error('invalid match method in attribute selector: ' + pos);
              }
              ss.getLastAttributeSelelector().match += ch + '=';
              states.attrName = false;
              states.attrValue = true;
              pos = Selectors.eatWhitespaces(selectorsGroupString, pos + 1);
              break;
            case ']':
              if (ss.getLastAttributeSelelector().name == '') {
                throw new Error('Expected attribute name or namespace but found "' + ch  + '": ' + pos);
              }
              ss.getLastAttributeSelelector().match = Selectors.SimpleSelector.Attribute.PRESENCE;
              states.allFalse();
              states.type = true;
              if (selectorsGroupString.charAt(skipWhitespace) == ',') {
                pos = skipWhitespace;
              } else {
                ++pos;
              }
              break;
            default:
              if (Selectors.WHITESPACE.test(ch)) {
                // TODO: check if the following character is allowed
                pos = skipWhitespace;
                break;
              }
              ss.getLastAttributeSelelector().name += ch;
              ++pos;
          }
          continue;
        }//}}}

        //{{{ attribute selector value
        if (states.attrValue) {
          switch (ch) {
            case '"':
            case "'":
              if (openQuote == null) {
                if (escaped) {
                  ss.getLastAttributeSelelector().value += ch;
                  ++pos;
                } else {
                  openQuote = ch;
                  ++pos;
                }
              } else if (!escaped && ((ch == '"' && openQuote == '"') || (ch == "'" && openQuote == "'"))) {
                if (selectorsGroupString.charAt(skipWhitespace) != ']') {
                  throw new Error('Missing "]" after attribute selector: ' + skipWhitespace);
                }
                // TODO: check white-space or "[" after "]"
                openQuote = null;
                pos = skipWhitespace + 1;
                states.allFalse();
                states.type = true;
                if (selectorsGroupString.charAt(Selectors.eatWhitespaces(selectorsGroupString, pos)) == ',') {
                  pos = Selectors.eatWhitespaces(selectorsGroupString, pos);
                }
              } else {
                ss.getLastAttributeSelelector().value += ch;
                ++pos;
              }
              break;
            case ']':
              if (!openQuote && !escaped) {
                states.allFalse();
                states.type = true;
                ++pos;
                break;
              } else {
                // continue to "default:"
              }
            default:
              if (!openQuote && !escaped && Selectors.WHITESPACE.test(ch)) {
                  pos = skipWhitespace;
                  ch = selectorsGroupString.charAt(pos);
                  if (ch != ']') {
                    throw new Error('Expected "]" to terminate attribute selector but found "' + ch + '": ' + pos);
                  }
                  states.allFalse();
                  states.type = true;
                  ++pos;
                  continue;
              }
              ss.getLastAttributeSelelector().value += ch;
              ++pos;
          }
          continue;
        } //}}}

      } //}}}

      //{{{ pseudo-class
      if (states.pc) {
        //{{{ psedo-class name
        if (states.pcName) {

          if (Selectors.WHITESPACE.test(ch)) {
            if (selectorsGroupString.charAt(skipWhitespace) == ',') {
              pos = skipWhitespace;
            }
            states.allFalse();
            states.type = true;
            continue;
          }

          var pc = ss.getLastPseudoClass();
          switch (ch) {
            case ')':
            case ':':
            case '[':
            case ',':
            case '#':
            case '.':
            case Selectors.Combinator.CHILD:
            case Selectors.Combinator.ADJACENT_SIBLING:
            case Selectors.Combinator.GENERAL_SIBLING:
              states.allFalse();
              states.type = true;
              break;
            case '(':
              states.pcName = false;
              if (pc.name == 'not') {
                if (states.not) {
                  throw new Error("Negation pseudo-classes are not allowed inside the negation pseudo-class");
                }
                states.allFalse();
                states.not = true;
                states.type = true;
                pos = skipWhitespace;
                pc.ownerSelector = ss;
                ss = new Selectors.SimpleSelector();
                negation = pc;
              } else {
                states.pcName = false;
                states.pcArg = true;
                pc.arg = '';
                pos = skipWhitespace;
              }
              continue;
              break;
            default:
              // TODO: validate ch
              pc.name += ch.toLowerCase();
              ++pos;
              continue;
              break;

          }
        } //}}}
        //{{{ pseudo-class argument
        else if (states.pcArg) {
          if (ch == ')') {
            states.allFalse();
            states.type = true;
            ++pos;
          } else {
            pc.arg += ch;
            ++pos;
          }
          continue;
        } //}}}
      }
      //}}}

      //{{{ whitespace
      if (Selectors.WHITESPACE.test(ch)) {
        pos = skipWhitespace;
        ch = selectorsGroupString.charAt(pos);
        states.allFalse();
        states.type = true;
        if (states.not) {
          if (ch != ')') {
            throw new Error('Syntax error, unexpected "' + ch + '": ' + pos);
          }
        } else if (ch != ',') {
          selector.add(ss);
          switch (ch) {
            case Selectors.Combinator.CHILD:
            case Selectors.Combinator.ADJACENT_SIBLING:
            case Selectors.Combinator.GENERAL_SIBLING:
              selector.add(new Selectors.Combinator(ch));
              pos = Selectors.eatWhitespaces(selectorsGroupString, pos);
              break;
            default:
              selector.add(new Selectors.Combinator(Selectors.Combinator.DESCENDANT));
          }
          ss = new Selectors.SimpleSelector();
          states.allFalse();
          states.type = true;
        }
        continue;

      } //}}}

      //{{{ type
      switch (ch) {
        case Selectors.Combinator.CHILD:
        case Selectors.Combinator.ADJACENT_SIBLING:
        case Selectors.Combinator.GENERAL_SIBLING:
          selector.add(ss);
          selector.add(new Selectors.Combinator(ch));
          ss = new Selectors.SimpleSelector();
          pos = skipWhitespace;
          states.allFalse();
          states.type = true;
          continue;
        break;
        case '.':
          if (ss.type == '') {
            ss.type = '*';
          }
          var attr = new Selectors.SimpleSelector.Attribute();
          attr.name = 'class';
          attr.value = '';
          attr.match = Selectors.SimpleSelector.Attribute.INCLUDES;
          ss.attributes.push(attr);
          states.allFalse();
          states.clazz = true;
          break;
        case '#':
          if (ss.type == '') {
            ss.type = '*';
          }
          var attr = new Selectors.SimpleSelector.Attribute();
          attr.name = 'id';
          attr.value = '';
          attr.match = Selectors.SimpleSelector.Attribute.EQUALS;
          ss.attributes.push(attr);
          states.allFalse();
          states.id = true;
          ss.hasId = true;
          break;
        case '[':
          if (ss.type == '') {
            ss.type = '*';
          }
          states.allFalse();
          states.attr = true;
          states.attrName = true;
          attr = new Selectors.SimpleSelector.Attribute();
          attr.name = '';
          ss.attributes.push(attr);
          pos = skipWhitespace;
          continue;
          break;
        case ':':
          if (selectorsGroupString.charAt(pos + 1) == ':') {
            if (states.not) {
              throw new Error("Pseudo-elements are not allowed in the negation pseudo-class");
            } else {
              throw new Error('Pseudo-elements not implemented: ' + pos);
            }
          }
          if (ss.type == '') {
            ss.type = '*';
          }
          states.allFalse();
          states.pc = true;
          states.pcName = true;
          var ps = new Selectors.SimpleSelector.PseudoClass();
          ps.name = '';
          ss.pseudoClasses.push(ps);
          break;
        case ')':
          if (!states.not) {
            throw new Error('Parse error: unexpected ")" at position ' + pos);
          }
          states.allFalse();
          states.not = false;
          states.type = true;
          negation.arg = ss;
          ss = negation.ownerSelector;
          negation = null;
          break;
        case ',':
          selector.add(ss);
          selector = new Selectors.Selector();
          selectors.push(selector);
          ss = new Selectors.SimpleSelector();
          states.allFalse();
          states.type = true;
          pos = skipWhitespace;
          continue;
        case '*':
          if (!states.type || (states.type && ss.type.length > 0)) {
            throw new Error('Misplaced universal selector: ' + pos);
          }
          ss.type = ch;
          break;
        case '|':
          throw new Error('Namespaces not implemented: ' + pos);
          break;
        default:
          if (states.clazz || states.id) {
            ss.getLastAttributeSelelector().value += ch;
          } else if (states.type) {
            ss.type += ch;
          } else {
            throw new Error('Internal parse error');
          }
      } //}}}

      ++pos;

    }

    if (states.attrValue) {
      throw new Error('Unclosed atribut selector value');
    }
    if (states.attr) {
      throw new Error('Unclosed atribut selector');
    }
    if ((states.clazz || states.id) && ss.getLastAttributeSelelector().value.length == 0) {
      throw new Error('Empty class or id:' + pos);
    }
    if (ss.type.length == 0) {
      throw new Error('Empty selector');
    }

    selector.add(ss);
    return selectors;
  }, //}}}

  //{{{ eatWhitespaces()
  /**
   * @param String string
   * @param Number pos
   * @return Number - position of next non-white space character
   */
  eatWhitespaces: function(string, pos) {
    ++pos;
    while (pos <= string.length && this.WHITESPACE.test(string.charAt(pos))) {
      ++pos;
    }
    return pos;
  }, //}}}

  //{{{ nodeListToArray()
  /**
   * @param NodeList nodeList
   * @return Array<Element>
   */
  nodeListToArray: function(nodeList) {
    var i, array = [], len = nodeList.length;
    for (i = 0; i < len; i++) {
      array[i] = nodeList[i];
    }
    return array;
  }, //}}}

  //{{{ escapeRe()
  /**
   * @see http://simonwillison.net/2006/Jan/20/escape/
   */
  escapeRe: function(text) {
    if (!arguments.callee.sRE) {
      var specials = ['.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\'];
      arguments.callee.sRE = new RegExp('(\\' + specials.join('|\\') + ')', 'g'  );
    }
    return text.replace(arguments.callee.sRE, '\\$1');
  }, //}}}

  //{{{ unique()
  /**
   * @param Array orig
   * @return Array
   */
  unique: function(orig) {
    var i, j, uniq = [], origLenght = orig.length;
    loopOrig:for (i = 0; i < origLenght; i++) {
      for (j = 0; j < uniq.length; j++) {
        if (orig[i] == uniq[j]) {
          continue loopOrig;
        }
      }
      uniq.push(orig[i]);
    }
    return uniq;
  }, //}}}

  //{{{ compareTagName()
  compareTagName: function(tagNameA, tagNameB) {
    // TODO: xml - case
    return tagNameA.toLowerCase() == tagNameB.toLowerCase();
  }, //}}}

  //{{{ dump()
  dump: function (selectorString, selectors, resultElements) {
    function sh(t) {
      return t.toString().replace('>', '&gt;').replace('<', '&lt;');
    }
    var html = '<h1><code>' + sh(selectorString) + '</code></h1>';
    html += '<h2>Query</h2>';
    html += '<ul>';
    for (var i = 0; i < selectors.length; i++) {
      html += '<li><strong>Selector #' + (i+1) + ' (' + selectors[i].getSpecificity() + ')</strong><ol>';

      var components = selectors[i].components;

      for (var j = 0; j < components.length; j++) {

        var component = components[j];

        html += '<li><pre>';
        html += '\n<strong>';
        if (component instanceof Selectors.SimpleSelector) {
          html += 'SimpleSelector <code>"' + sh(component.type) + '"</code>';
          var sel = true;
        } else {
          html += 'Combinator <code>"' + sh(component.value) + '"</code>';
        }
        html += '</strong>';

        if (sel) {
          if (component.attributes.length) {
            html += '\n\n  <em>Attribute selectors:</em>';
          }
          for (var k = 0; k < component.attributes.length; k++) {
            html += '\n    ' + sh(component.attributes[k].toString());
          }
          if (component.pseudoClasses.length) {
            html += '\n  \n  <em>Pseudo-classes:</em>';
          }
          for (var k = 0; k < component.pseudoClasses.length; k++) {
            html += '\n    ' + sh(component.pseudoClasses[k].toString());
          }
        }
        sel = false;
        html += '</pre></li>';

      }
      html += '</ol></li>';
    }
    html += '</ul>';
    html += '<h2>Result</h2>';
    html += '<ol>';
    var xs = new XMLSerializer();
    for (var i = 0; i < resultElements.length; i++) {
      var html2 = xs.serializeToString(resultElements[i]);
      html2 = html2.match(/[^>]+>/, html2)[0];
      html += '<li><pre>' + sh(html2) + '</pre></li>';
    }
    html += '</ol>';
    var w = window.open('', 'selectorsDump');
    w.document.write(html);
    w.document.close();
    w.focus();
  } //}}}

}

//}}}

//{{{ Selectors.Selector ()

Selectors.Selector = function() {
  this.components = [];
}

Selectors.Selector.prototype = {

  //{{{ add()
  /**
   * @param Selectors.SimpleSelector|Selectors.Combinator component
   */
  add: function(component) {
    if (component instanceof Selectors.Combinator) {
      if (this.components.length == 0) {
        throw new Error('First component in selector must be a SimpleSelector');
      }
      if (this.components[this.components.length - 1] instanceof Selectors.Combinator) {
        throw new Error('Combinator must be followed by SimpleSelector');
      }
    } else if (component instanceof Selectors.SimpleSelector) {
      if (this.components.length > 0 && this.components[this.components.length - 1] instanceof Selectors.SimpleSelector) {
        throw new Error('SimpleSelector must be followed by Combinator');
      }
    } else {
      throw new Error('Unknown selector componnet: ' + component);
    }
    this.components.push(component);
  }, //}}}

  //{{{ findElements()
  /**
   * @param Document|Element root
   * @return Array<Element>
   */
  findElements: function(root) {
    var i, j, elements, tmpElements, combinator, simpleSelector;
    simpleSelector = this.components[0];
    elements = simpleSelector.findElements(root || document, new Selectors.Combinator(Selectors.Combinator.DESCENDANT));
    for (i = 1; i < this.components.length; i += 2) {
      combinator = this.components[i];
      simpleSelector = this.components[i + 1];
      tmpElements = [];
      for (j = 0; j < elements.length; j++) {
        tmpElements = tmpElements.concat(simpleSelector.findElements(elements[j], combinator));
      }
      elements = tmpElements;
    }
    return elements;
  }, //}}}

  //{{{ getSpecificity()
  /**
   * @see http://www.w3.org/TR/css3-selectors/#specificity
   */
  getSpecificity: function() {
    var comp, specificity2, specificity = {a: 0, b: 0, c: 0};
    for (var i = 0; i < this.components.length; i++) {
      comp = this.components[i];
      if (comp instanceof Selectors.SimpleSelector) {
        specificity2 = comp.getSpecificity();
        specificity.a += specificity2.a;
        specificity.b += specificity2.b;
        specificity.c += specificity2.c;
      }
    }
    return Number(String(specificity.a) + String(specificity.b) + String(specificity.c));
  } //}}}

} //}}}

//{{{ Selectors.SimpleSelector()

Selectors.SimpleSelector = function() {
  this.type = '';
  this.attributes = [];
  this.pseudoClasses = [];
  this.hasId = false; // for calculating a selector's specificity
}

Selectors.SimpleSelector.prototype = {

  //{{{ toString()
  toString: function() {
    var string = '';
    string += '[SimpleSelector type="' + this.type;
    string += '", ' + this.attributes.join(', ');
    string += ', ' + this.pseudoClasses.join(', ');
    string += ']';
    return string;
  }, //}}}

  //{{{ findElements()
  /**
   * @param Element contextNode
   * @param Selectors.Combinator combinator
   * @return Array<Element>
   */
  findElements: function(contextNode, combinator) {
    var i;
    var nodes, node;
    var foundNodes = [];
    nodes = combinator.findElements(contextNode, this.type);
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      if (this.test(node)) {
        foundNodes.push(node);
      }
    }
    return foundNodes;
  }, //}}}

  //{{{ test()
  /**
   * Tests this selector's attribute selectors and pseudo-classes
   * against given element.
   *
   * @param Element element
   * @return Boolean
   */
  test: function(element, checkTagName) {
    var i;

    if (checkTagName === true && this.type != '*'
      && !Selectors.compareTagName(element.tagName, this.type)) {
      return false;
    }

    for (i = 0; i < this.attributes.length; i++) {
      if (!this.attributes[i].test(element)) {
        return false;
      }
    }
    for (i = 0; i < this.pseudoClasses.length; i++) {
      if (!this.pseudoClasses[i].test(element)) {
        return false;
      }
    }
    return true;
  }, //}}}

  //{{{ getSpecificity()
  getSpecificity: function() {
    var specificity = {a: 0, b: 0, c: 0};
    // A
    if (this.hasId) {
      specificity.a = 1;
    }
    // B
    var idCounted = false;
    for (var i = 0; i < this.attributes.length; i++) {
      if (this.attributes[i].name == 'id'
        && this.attributes[i].match == Selectors.SimpleSelector.Attribute.EQUALS
        && this.hasId && !idCounted)
      {
        idCounted = true;
        continue;
      }
      ++specificity.b;
    }
    // C
    for (var i = 0; i < this.pseudoClasses.length; i++) {
      if (this.pseudoClasses[i].name == 'not') {
        var specificity2 = this.pseudoClasses[i].arg.getSpecificity();
        specificity.a += specificity2.a;
        specificity.b += specificity2.b;
        specificity.c += specificity2.c;
      } else {
        ++specificity.b;
      }
    }
    if (this.type != '*') {
      specificity.c = 1;
    }
    return specificity;
  }, //}}}

  //{{{ getLastAttributeSelelector()
  getLastAttributeSelelector: function() {
    return this.attributes[this.attributes.length - 1];
  }, //}}}

  //{{{ getLastPseudoClass()
  getLastPseudoClass: function() {
    return this.pseudoClasses[this.pseudoClasses.length - 1];
  } //}}}

}

//}}}

//{{{ Selectors.SimpleSelector.Attribute()

/**
 * @see http://www.w3.org/TR/css3-selectors/#attribute-selectors
 */

Selectors.SimpleSelector.Attribute = function() {
  this.name = null;
  this.match = '';
  this.value = '';
}

Selectors.SimpleSelector.Attribute.PRESENCE = '';
Selectors.SimpleSelector.Attribute.EQUALS = '=';
Selectors.SimpleSelector.Attribute.INCLUDES = '~=';
Selectors.SimpleSelector.Attribute.DASHMATCH = '|=';
Selectors.SimpleSelector.Attribute.PREFIXMATCH = '^=';
Selectors.SimpleSelector.Attribute.SUFFIXMATCH = '$=';
Selectors.SimpleSelector.Attribute.SUBSTRINGMATCH = '*=';

Selectors.SimpleSelector.Attribute.prototype = {

  //{{{ toString()
  toString: function() {
    return '[Attribute name="' + this.name
        + '", match="' + this.match
        + '", value="' + this.value + '"]';
  }, //}}}

  //{{{ test()
  /**
   * @param Element element
   * @return Boolean
   */
  test: function(element) {
    var attrValue = element.getAttribute(this.name);
    if (attrValue == null) {
      return false;
    }
    switch (this.match) {
      case Selectors.SimpleSelector.Attribute.PRESENCE:
        return element.hasAttribute(this.name);
      case Selectors.SimpleSelector.Attribute.EQUALS:
        return attrValue == this.value;
      case Selectors.SimpleSelector.Attribute.INCLUDES:
        var tokens = attrValue.replace(/^\s+|\s+$/g, '').split(/\s+/);
        for (var i = 0; i < tokens.length; i++) {
          if (tokens[i] == this.value) {
            return true;
          }
        }
        return false;
      case Selectors.SimpleSelector.Attribute.DASHMATCH:
        return attrValue == this.value || (new RegExp('^' + Selectors.escapeRe(this.value) + '-')).test(attrValue);
      case Selectors.SimpleSelector.Attribute.PREFIXMATCH:
        return attrValue.indexOf(this.value) == 0;
      case Selectors.SimpleSelector.Attribute.SUFFIXMATCH:
        return attrValue.lastIndexOf(this.value) == attrValue.length - this.value.length;
      case Selectors.SimpleSelector.Attribute.SUBSTRINGMATCH:
        return attrValue.indexOf(this.value) > -1;
      default:
        throw new Error(this + ': Invalid match method: "' + this.match + '"');
    }
  } //}}}

}

//}}}

//{{{ Selectors.SimpleSelector.PseudoClass()

Selectors.SimpleSelector.PseudoClass = function() {
  this.name = null;
  this.arg = null;
  this.isValid = null;
}

Selectors.SimpleSelector.PseudoClass.prototype = {

  toString: function() {
    return '[PseudoClass name="' + this.name + '", arg="' + (this.arg ? this.arg.toString() : this.arg) + '"]';
  },

  /**
   * @return Boolean - is this valid pseudo-class?
   */
  validate: function() {
    if (this.isValid == null) {
      this.isValid = this.methods[this.name.toLowerCase()] instanceof Function;
    }
    return this.isValid;
  },

  /**
   * @param Element element
   * @return Boolean
   */
  test: function(element) {
    if (!this.validate()) {
      throw new Error('Invalid psedo-class "' + this.name + '"');
    }
    return this.methods[this.name.toLowerCase()].call(this, element);
  },

  //{{{ getOrder()
  /**
   * @param Element element
   * @param Boolean fromEnd - count position from end
   * @param Boolean sameType - if true, than elements of other types will be
   *               be ignored
   * @return Number - position of element in its parent
   */
  getOrder: function(element, fromEnd, sameType) {
    var curNode, order = 1;
    var dir = fromEnd ? 'nextSibling': 'previousSibling';
    for (curNode = element[dir]; curNode != null; curNode = curNode[dir]) {
      if (curNode.nodeType == Node.ELEMENT_NODE
        && (!sameType || Selectors.compareTagName(element.tagName, curNode.tagName))) {
        ++order;
      }
    }
    return order;
  }, //}}}

  //{{{ nthTest()
  /**
   * @param Number order
   * @return Boolean
   */
  nthTest: function(order) {
    // TODO: parse this.arg only once
    var arg = this.arg.replace(/^\s+|\s+$/g, '');
    var parts, a, b;
    switch (arg) {
      case 'n':
        return true;
      case 'odd':
        return order % 2 != 0;
      case 'even':
        return order % 2 == 0;
      default:
        if (/^\d+$/.test(arg)) {
          // :nth-child(5)
          return order == arg;
        }
        if (/^\d+n$/.test(arg)) {
          // :nth-child(5n)
          return order % parseInt(arg) == 0;
        }
        parts = arg.match(/^((\d+)|-)?n([-+])(\d+)$/);
        if (parts != null) {
          a = parts[1];
          b = parts[4];
          if (a == '-') {
            // :nth-child(-n+2)
            return order <= b;
          }
          if (a == '') {
            // :nth-child(n+2)
            a = 1;
          }
          if (parts[3] == '-') {
            // :nth-child(an-2)
            b = a - b;
          }
          return order >= b && ((order - b) % a == 0);
        } else {
          throw new Error('Invalid argument for ":' + this.name
                  + '" pseudo-class: "' + this.arg + '"');
        }
    }

    return false;
  }, //}}}

  /**
   * @param Element element
   * @retrun Boolean
   */
  isRoot: function(element) {
    return element == element.ownerDocument.documentElement;
  },

  methods: {

    //{{{ 6.6.1. Dynamic pseudo-classes

    'link': function(element) {
      return false; // Error(':' + this.name + " not implemented yet")
    },

    'visited': function(element) {
      return false; // Error(':' + this.name + " not implemented yet")
    },

    'hover': function(element) {
      return false; // Error(':' + this.name + " not implemented yet")
    },

    'active': function(element) {
      return false; // Error(':' + this.name + " not implemented yet")
    },

    'focus': function(element) {
      return false; // Error(':' + this.name + " not implemented yet")
    },

    //}}}

    //{{{ 6.6.2. The target pseudo-class :target

    'target': function(element) {
      var hash;
      if (location.hash) {
        hash = location.hash.substr(1);
        if (element.getAttribute('id') == hash || element.getAttribute('name') == hash) {
          return true;
        }
      }
      return false;
    },

    //}}}

    //{{{ 6.6.3. The language pseudo-class :lang

    'lang': function(element) {
      // TODO: @xml:lang
      for (var parent = element; parent != null && parent != document; parent = parent.parentNode) {
        if (parent.hasAttribute('lang')) {
          if (parent.getAttribute('lang') == this.arg || (new RegExp('^' + Selectors.escapeRe(this.arg) + '-', 'i')).test(parent.getAttribute('lang'))) {
            return true;
          }
          return false;
        }
      }
      return false;
    },

    //}}}

    //{{{ 6.6.4. The UI element states pseudo-classes

    'enabled': function(element) {
      return element.disabled === false;
    },

    'disabled': function(element) {
      return element.disabled === true;
    },

    'checked': function(element) {
      return element.checked === true;
    },

    'indeterminate': function(element) {
      return false; // Error('Pseudo-class :' + this.name + " not implemented")
    },

    //}}}

    //{{{ 6.6.5. Structural pseudo-classes

    'root': function(element) {
      return this.isRoot(element);
    },

    'nth-child': function(element) {
      return !this.isRoot(element) && this.nthTest(this.getOrder(element, false, false));
    },

    'nth-last-child': function(element) {
      return !this.isRoot(element) && this.nthTest(this.getOrder(element, true, false));
    },

    'nth-of-type': function(element) {
      return !this.isRoot(element) && this.nthTest(this.getOrder(element, false, true));
    },

    'nth-last-of-type': function(element) {
      return !this.isRoot(element) && this.nthTest(this.getOrder(element, true, true));
    },

    'first-child': function(element) {
      if (this.isRoot(element)) {
        return false;
      }
      for (var curNode = element.previousSibling; curNode != null; curNode = curNode.previousSibling) {
        if (curNode.nodeType == Node.ELEMENT_NODE) {
          return false;
        }
      }
      return true;
    },

    'last-child': function(element) {
      if (this.isRoot(element)) {
        return false;
      }
      for (var curNode = element.nextSibling; curNode != null; curNode = curNode.nextSibling) {
        if (curNode.nodeType == Node.ELEMENT_NODE) {
          return false;
        }
      }
      return true;
    },

    'first-of-type': function(element) {
      if (this.isRoot(element)) {
        return false;
      }
      for (var curNode = element.previousSibling; curNode != null; curNode = curNode.previousSibling) {
        if (curNode.nodeType == Node.ELEMENT_NODE && Selectors.compareTagName(curNode.tagName, element.tagName)) {
          return false;
        }
      }
      return true;
    },

    'last-of-type': function(element) {
      if (this.isRoot(element)) {
        return false;
      }
      for (var curNode = element.nextSibling; curNode != null; curNode = curNode.nextSibling) {
        if (curNode.nodeType == Node.ELEMENT_NODE && Selectors.compareTagName(curNode.tagName, element.tagName)) {
          return false;
        }
      }
      return true;
    },

    'only-child': function(element) {
      if (this.isRoot(element)) {
        return false;
      }
      for (var curNode = element.parentNode.firstChild; curNode != null; curNode = curNode.nextSibling) {
        if (curNode.nodeType == Node.ELEMENT_NODE && curNode != element) {
          return false;
        }
      }
      return true;
    },

    'only-of-type': function(element) {
      if (this.isRoot(element)) {
        return false;
      }
      for (var curNode = element.parentNode.firstChild; curNode != null; curNode = curNode.nextSibling) {
        if (curNode.nodeType == Node.ELEMENT_NODE && Selectors.compareTagName(curNode.tagName, element.tagName) && curNode != element) {
          return false;
        }
      }
      return true;
    },

    'empty': function(element) {
      return !element.hasChildNodes();
    },

    //}}}

    //{{{ 6.6.7. The negation pseudo-class

    'not': function(element) {
      if (this.arg instanceof Selectors.SimpleSelector) {
        return !this.arg.test(element, true);
      }
      return false; // Error("Missing argument for :not()")
    },

    //}}}

    //{{{ Compatibility for CSS 1 and CSS 2 one-colon pseudo-elements notation
    'first-line': function(element) {return false; /* Error('Pseudo-elements not implemented') */},
    'first-letter': function(element) {return false; /* Error('Pseudo-elements not implemented') */},
    'before': function(element) {return false; /* Error('Pseudo-elements not implemented') */},
    'after': function(element) {return false; /* Error('Pseudo-elements not implemented') */}
    //}}}

  }
}

//}}}

//{{{ Selectors.Combinator()

/**
 * @see http://www.w3.org/TR/css3-selectors/#combinators
 */

Selectors.Combinator = function(value) {
  this.value = value;
}

Selectors.Combinator.ADJACENT_SIBLING = '+';
Selectors.Combinator.CHILD = '>';
Selectors.Combinator.DESCENDANT = ' ';
Selectors.Combinator.GENERAL_SIBLING  = '~';

Selectors.Combinator.prototype = {

  //{{{ toString()
  toString: function() {
    return '[Combinator "' + this.value + '"]';
  }, //}}}

  //{{{ findElements()
  /**
   * @param Element contextElement
   * @param String tagName
   * @return Array<Element>
   */
  findElements: function(contextElement, tagName) {
    var elements = [];

    switch (this.value) {

      case Selectors.Combinator.DESCENDANT:
        elements = Selectors.nodeListToArray(contextElement.getElementsByTagName(tagName));
      break;

      case Selectors.Combinator.CHILD:
        for (var curNode = contextElement.firstChild; curNode != null; curNode = curNode.nextSibling) {
          if (curNode.nodeType == Node.ELEMENT_NODE && (tagName == '*' || Selectors.compareTagName(curNode.nodeName, tagName))) {
            elements.push(curNode);
          }
        }
      break;

      case Selectors.Combinator.ADJACENT_SIBLING:
        for (var curNode = contextElement.nextSibling; curNode != null; curNode = curNode.nextSibling) {
          if (curNode.nodeType == Node.ELEMENT_NODE) {
            if (tagName == '*' || Selectors.compareTagName(curNode.tagName, tagName)) {
              elements.push(curNode);
            }
            break;
          }
        }
      break;

      case Selectors.Combinator.GENERAL_SIBLING:
        for (var curNode = contextElement.nextSibling; curNode != null; curNode = curNode.nextSibling) {
          if (curNode.nodeType == Node.ELEMENT_NODE) {
            if (tagName == '*' || Selectors.compareTagName(curNode.tagName, tagName)) {
              elements.push(curNode);
            }
          }
        }
      break;

    }
    return elements;
  } //}}}
}

//}}}


