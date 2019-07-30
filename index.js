const _escape = require('lodash/escape')
const fs = require('fs-extra')
const glob = require('glob')
const inquirer = require('inquirer')
const path = require('path')
const prettyhtml = require('@starptech/prettyhtml')

module.exports = {
  cleanRoutine () {
    console.log('overwrite this method with your own rules')
    this.prettyHtml().save()
  },
  config: {
    baseDirectory: null,
    dialog: null,
    framework: null,
    prettyHtml: null,
    regex: {
      find: Function.prototype,
      replace: Function.prototype
    },
    singleFilePath: null
  },
  async init (config) {
    this.config = config
    try {
      // if theres a process.argv then clean only that file.
      if (config.singleFile && config.singleFile.filePath) {
        this.singleFileCleanRoutine() // now run that single clean job
      } else {
        // present user with menu so they can choose what to run.
        this.config.dialog.choices = await this.getDirectoriesSync(this.config.baseDirectory)

        let { list, filterOut } = await this.prompt(this.config.dialog)

        filterOut = typeof filterOut === 'string' ? [filterOut] : filterOut
        list.forEach(async (filePath) => {
          const fileContents = await this.readFile(filePath)
          this.prettyContents = this.getComponentHtml(fileContents)
          if (this.prettyContents) {
            this.cleanRoutine()
          }
        })
      }
    } catch (error) {
      console.log(error)
      process.exit(1)
    }
  },
  // wraps single nodes with innerHtml onto 3 lines
  formatTextNodes () {
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines
      .map(line => line.replace(/(\s{2,})>(?!<)(.*)?(<\/.*)/g, '$1>\n$1  $2\n$1$3'))
      .join('\n')

    return this
  },
  // extract just the part we need to format out of the passed in file
  getComponentHtml (contents) {
    let componentHtml = ''

    try {
      componentHtml = this.config.regex.find.call(this, contents)
    } catch (e) {
      console.log(`Could not gather the component template for ${this.filePath}`)
    }

    return componentHtml
  },
  async getDirectoriesSync (globPatterns) {
    const response = []
    const patterns = typeof globPatterns === String ? [globPatterns] : globPatterns

    await patterns.forEach(async (pattern) => {
      const paths = await glob(pattern, { mark: true, sync: true })
      response.push(...paths)
    })
    return response.sort()
  },
  // order classNames, by component first, then remaining framework classes all alpha'd
  orderClassNames () {
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines.map(line => {
      const matches = line.match(/(.*\s+class=")(.*)(?:")(.*)/)

      // there's a handlebars variable as a class name, do not sort it.
      if (matches && !matches.includes('{')) {
        const classes = matches[2].trim().split(' ')
        const componentClasses = []
        const frameworkClasses = []
        const frameworkPrefixes = this.config.framework.utilClasses

        classes.forEach(className => {
          const frameWorkClass = frameworkPrefixes.find(prefix => className.startsWith(prefix));

          (frameWorkClass ? frameworkClasses : componentClasses).push(className)
        })

        componentClasses.sort()
        frameworkClasses.sort()

        const orderedClassNames = componentClasses.concat(frameworkClasses).join(' ')

        return `${matches[1]}${orderedClassNames}"${matches[3]}`
      }

      return line
    }).join('\n')

    return this
  },
  // invoke the original pretty call, which gets us about 80% there with formatting.
  prettyHtml () {
    const prettyConfig = this.config.prettyHtml
    this.prettyContents = prettyhtml(this.prettyContents, prettyConfig).contents
    return this
  },
  prompt (dialog) {
    return inquirer.prompt(dialog)
  },
  async readFile (filePath) {
    try {
      await fs.stat(filePath)
      this.filePath = filePath
      this.originalContents = fs.readFileSync(filePath, 'utf8')
      return this.originalContents
    } catch (e) {
      console.error('No file was passed in')
      process.exit(1)
    }
  },
  // returns the absolute path from a relative one
  relativePath (filePath) {
    return path.resolve(__dirname, '..', filePath)
  },
  rightTrim () {
    this.prettyContents = this.prettyContents.split('\n').map((line) => line.trimRight()).join('\n')

    return this
  },
  save () {
    const find = this.config.regex.find
    const replace = this.config.regex.replace
    const newContents = this.originalContents.replace(find.call(this, this.originalContents), replace.call(this, this.prettyContents))

    this.writeFile(newContents)
  },
  async singleFileCleanRoutine () {
    let filePath = this.config.singleFile.filePath
    filePath = filePath.startsWith('.') ? this.relativePath(filePath) : filePath

    // alter the config for singleFile "mode" so that single file's setting are used further on
    delete this.config.singleFile.filePath

    this.config = { ...this.config, ...this.config.singleFile }

    const fileContents = await this.readFile(filePath)
    this.prettyContents = this.getComponentHtml(fileContents)

    if (this.prettyContents) {
      this.cleanRoutine()
    }
  },
  async writeFile (contents) {
    try {
      await fs.writeFile(this.filePath, contents, 'utf8')
    } catch (e) {
      console.error(e)
    }
  },
  // ensures alt is written alt="" when void
  voidAttributes (voidAttributes = ['alt']) {
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines.map((line) => {
      let l = line
      voidAttributes.forEach((attr) => {
        if (l.match(new RegExp(_escape(`${attr}$`), 'g'))) {
          l = l.replace(attr, `${attr}=""`)
        }
      })

      return l
    }).join('\n')

    return this
  }
}
