export class Logger {
  constructor(prefix = '') {
    this.prefix = prefix;
  }

  log(...args) {
    console.log(this._format('INFO'), ...args);
  }

  warn(...args) {
    console.warn(this._format('WARN'), ...args);
  }

  error(...args) {
    console.error(this._format('ERROR'), ...args);
  }

  success(...args) {
    console.log(this._format('SUCCESS'), ...args);
  }

  _format(level) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}]${this.prefix ? ` [${this.prefix}]` : ''}`;
  }
}

export default new Logger('Pipeline');
