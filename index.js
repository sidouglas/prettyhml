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
    console.log('overwrite this method with your own rules')
    this.prettyHtml().save()
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
    try {
      // if theres a process.argv then clean only that file.
      if (config.singleFile && config.singleFile.filePath) {
        this.singleFileCleanRoutine() // now run that single clean job
      } else {
        // present user with menu so they can choose what to run.
        this.config.dialog.choices = this.getDirectoriesSync(this.config.baseDirectory)

        let { list, filterOut } = await this.prompt(this.config.dialog)

        filterOut = typeof filterOut === 'string' ? [filterOut] : filterOut

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
      componentHtml = contents.match(this.config.regex.find)[1]
    } catch (e) {
      console.log(`Could not gather the component template for ${this.filePath}`)
    }

    return componentHtml
  },
  getDirectoriesSync (filePaths) {
    filePaths = (typeof filePaths === 'string') ? [filePaths] : filePaths
    const output = []
    filePaths.forEach(filePath => {
      output.push(...fs.readdirSync(filePath).filter(folder => fs.statSync(path.join(filePath, folder)).isDirectory()))
    })
    return output
  },
  // order classNames, by component first, then remaining framework classes all alpha'd
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
    const lines = this.prettyContents.split('\n')

    this.prettyContents = lines.map((line, i) => (i === lines.length - 1) ? line : line.trimRight()).join('\n')

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
  }
}
