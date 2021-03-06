const exports = {};
import '../clarinet/clarinet.js';

export default base =>
class FetchAStream extends base {
  static get observedAttributes() {
    return ['url', 'auto', 'format']
  }
  static get properties() {
    return {
      url: {
        observer: '__autoFetch'
      },
      data: {
        value: ''
      },
      options: {
        value: {}
      },
      format: {
        value: 'text'
      }
    }
  }
  get parser() {
    return exports.parser();
  }
  get auto() {
    return this._auto || this.hasAttribute('auto');
  }
  set auto(value) {
    this._auto = value;
  }
  attributeChangedCallback(name, oldValue, newValue) {
    this[name] = newValue;
  }
  __autoFetch() {
    if (this.auto && this.url) {
      this.fetch();
    }
  }
  fire(name, detail) {
    this.dispatchEvent(new CustomEvent(name, {detail: detail}))
  }
  fetch() {
    this._fetch(this.url, this.options);
  }
  _fetch(url, options) {
    requestAnimationFrame(() => {
      fetch(url, {headers: this.headers, credentials: 'same-origin'}).then((response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let string = '';
        const handleStream = result => {
          // TODO: ensure done is not fired untill parser is done
          if (result.done) return this.fire('done', this.data);
          this.data += decoder.decode(result.value);
          this.parse(this.data, this.format);
          return reader.read().then(handleStream);
        }
        reader.read().then(handleStream);
      });
    })
  }
  /**
   * parse data by format, when json is selected, parses
   */
  parse(data, format) {
    if (format === 'json') {
      const parser = this.parser;
      let isArray = false;
      let objectOpen = false;
      let firstKey = false;
      let object = {}
      let current = null;
      parser.onvalue = value => {
        // this.object += value;
        if (firstKey) {
          object = {};
        }
        if (isArray) {
          const array = object[current];
          if (array && array.indexOf(value) === -1) {
            object[current] = [...array, value]
          } else if (!array) {
            object[current] = [value]
          }
        } else {
          object[current] = value
        }
      }
      parser.onkey = key => {
        current = key;
        firstKey = false;
      };
      parser.onopenobject = key => {
        current = key;
        firstKey = true;
        objectOpen = true;
      }
      parser.oncloseobject = key => {
        this.fire('update', object);
        firstKey = false;
        objectOpen = false;
      }
      parser.onopenarray = () => {
        if (objectOpen === true) {
          isArray = true;
        }
        // opened an array.
      };
      parser.onclosearray = () => {
        if (objectOpen === true) {
          isArray = false;
        }
        // closed an array.
      };
      parser.write(data);
    } else {
      // when text etc ...
      this.fire('update', data);
    }
  }
}
