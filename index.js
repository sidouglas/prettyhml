const prettyhtml = require('@starptech/prettyhtml')
const fs = require('fs-extra')
const path = require('path')
const inquirer = require('inquirer')

module.exports = {
  allFilesSync (dir, filter = ['.js']) {
    const fileList = []
    const filterList = filter

    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file)

      fileList.push(
        fs.statSync(filePath).isDirectory()
          ? { [file]: this.allFilesSync(filePath) }
          : filterList.includes(path.extname(file)) ? filePath : false
      )
    })

    return fileList
  },
  formatTextNodes () {
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines
      .map(line => line.replace(/(\s{2,})>(?!<)(.*)?(<\/.*)/g, '$1>\n$1  $2\n$1$3'))
      .join('\n')

    return this
  },
  getDirectoriesSync (filePath) {
    return fs.readdirSync(filePath).filter(folder => fs.statSync(path.join(filePath, folder)).isDirectory())
  },
  orderClassNames (prefixes) {
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines.map(line => {
      const matches = line.match(/(.*\s+class=")(.*)(?:")(.*)/)

      if (matches) {
        const classes = matches[2].trim().split(' ')
        const componentClasses = []
        const frameworkClasses = []
        const frameworkPrefixes = prefixes

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
  prettyHtml (config) {
    this.prettyContents = prettyhtml(this.prettyContents, config).contents

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
  selfCloseTags () {
    let needsClose = false
    const lines = this.prettyContents.split('\n')
    const selfClosing = [
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'keygen',
      'link',
      'meta',
      'param',
      'source',
      'track',
      'wbr'
    ].map(tag => `<${tag}`)

    this.prettyContents = lines.map(line => {
      let inspectedLine = line
      const trimmedLine = inspectedLine.trim()

      if (selfClosing.includes(trimmedLine)) {
        needsClose = true
      }

      if (trimmedLine === '>' && needsClose) {
        inspectedLine = inspectedLine.replace('>', '/>')
        needsClose = false
      }

      return inspectedLine
    }).join('\n')

    return this
  },
  async writeFile (contents) {
    try {
      await fs.writeFile(this.filePath, contents, 'utf8')
    } catch (e) {
      console.error(e)
    }
  }
}
