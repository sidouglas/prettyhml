const fs = require('fs-extra')
const inquirer = require('inquirer')
const path = require('path')
const prettyhtml = require('@starptech/prettyhtml')

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
  cleanRoutine () {

  },
  config: {
    baseDirectory: null,
    dialog: null,
    framework: null,
    prettyHtml: null,
    regex: null,
    singleFilePath: null
  },
  async init (config) {
    this.config = config
    const singleFileMode = this.singleFileCleanRoutine(config.singleFilePath)

    try {
      if (singleFileMode) {
        await singleFileMode()
      } else {
        this.config.dialog.choices = this.getDirectoriesSync(this.config.baseDirectory)

        let { list, filterOut } = await this.prompt(this.config.dialog)

        filterOut = typeof filterOut === 'string' ? [ filterOut ] : filterOut

        list.forEach((folder) => {
          this.allFilesSync(`${config.baseDirectory}/${folder}`, filterOut).forEach(async (filePath) => {
            const fileContents = await this.readFile(filePath)

            this.prettyContents = this.getComponentHtml(fileContents)
            if (this.prettyContents) {
              this.cleanRoutine()
            }
          })
        })
      }
    } catch (error) {
      console.log(error)
      process.exit(1)
    }
  },
  formatTextNodes () {
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines
      .map(line => line.replace(/(\s{2,})>(?!<)(.*)?(<\/.*)/g, '$1>\n$1  $2\n$1$3'))
      .join('\n')

    return this
  },
  getDirectoriesSync (filePaths) {
    filePaths = (typeof filePaths === 'string') ? [filePaths] : filePaths
    const output = []
    filePaths.forEach(filePath => {
      output.push(...fs.readdirSync(filePath).filter(folder => fs.statSync(path.join(filePath, folder)).isDirectory()))
    })
    return output
  },
  orderClassNames () {
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines.map(line => {
      const matches = line.match(/(.*\s+class=")(.*)(?:")(.*)/)

      if (matches) {
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
  relativePath (filePath) {
    return path.resolve(__dirname, '..', filePath)
  },
  rightTrim () {
    this.prettyContents = this.prettyContents.split('\n').map((line) => line.trimRight()).join('\n')

    return this
  },
  save () {
    const newContents = this.originalContents.replace(this.config.regex.find, this.config.regex.replace(this.prettyContents))

    this.writeFile(newContents)
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
  singleFileCleanRoutine (filePath) {
    if (filePath) {
      return async () => {
        filePath = filePath.startsWith('.') ? this.relativePath(filePath) : filePath
        this.prettyContents = await this.readFile(filePath)
        this.config.regex = {
          find: /[^]+/,
          replace: (content) => content
        }
        this.config.framework.colOffset = 0
        this.cleanRoutine()
      }
    }
  },
  async writeFile (contents) {
    try {
      await fs.writeFile(this.filePath, contents, 'utf8')
    } catch (e) {
      console.error(e)
    }
  }
}
