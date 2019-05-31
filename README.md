![Prettyhtml Banner](https://github.com/Prettyhtml/prettyhtml/raw/master/logo.png)

Opinionated general formatter for your Angular, Vue, Svelte or pure HTML5 templates. Try it on the [playground](https://prettyhtml.netlify.com/).

## Features

- Indentation based primary on node-level + tag length, not content.
- Can parse Angular, Vue or HTML5 templates.
- Formats embedded content with [prettier](https://github.com/prettier/prettier) with respect to your local settings.
- Doesn't change the behaviour of your attributes and tags.
- Remove all superfluous white-space. There are two additional rules:
  - Collapses multiple blank lines into a single blank line.
  - Empty lines at the start and end of blocks are removed. (Files always end with a single newline, though.)
- Enforce consistent output of your HTML.

## Framework specific features

| Feature                         | Framework |
| ------------------------------- | --------- |
| HTML5                           | all       |
| Self-closing custom elements    | vue       |
| Self-closing none void elements | vue       |
| Case-sensitive attributes       | angular   |
| Case-sensitive elements         | angular   |

## Usage
```
const parent = require('@sidouglas/prettyhtml');
const formatter = Object.create(parent);

formatter.cleanRoutine = async function () {
  this.prettyHtml()
    // put your clean routines in here...
    .formatTextNodes()
    .orderClassNames()
    .selfCloseTags()
    .indentPrettyContents()
    .rightTrim()
    .voidAttributes()
    .save();
};

formatter.init({
  baseDirectory: ['./src/scripts/vue/components/**/*.js', './src/scripts/vue/apps/**/*.js'],
  dialog: {
    message: 'What components/apps to tidy?',
    name: 'list',
    type: 'checkbox',
  },
  framework: {
    utilClasses: ['a-', 'l-', 'o-', 't', 'u-'],
    colOffset() {
      return this.config.isComponent(this.filePath) ? 4 : 2;
    },
  },
  isComponent(filePath) {
    return filePath.indexOf('components') > 0;
  },
  prettyHtml: {
    printWidth: 200,
    sortAttributes: true,
    wrapAttributes: true,
  },
  regex: {
    find(contents) {
      return contents.match(/(?:template.+`)([^`]*)(?:`)/)[1];
    },
    replace(content) {
      const offset = this.config.isComponent(this.filePath) ? '  ' : '';

      return `\n${content}${offset}`;
    },
  },
  ...(process.argv.slice(2)[0] ? singleFileInit : {}),
});
```


## Packages

- [prettyhtml](/packages/prettyhtml) CLI and API.
- [prettyhtml-formatter](/packages/prettyhtml-formatter) Formatter.
- [prettyhtml-hast-to-html](/packages/prettyhtml-hast-to-html) Stringifier.
- [prettyhtml-hastscript](/packages/prettyhtml-hastscript) Hyperscript compatible DSL for creating virtual HAST trees.
- [prettyhtml-sort-attributes](/packages/prettyhtml-sort-attributes) Sort attributes alphabetically.
- [prettyhtml-quick](/packages/prettyhtml-quick) Formats your changed files based on Git.
- [webparser](/packages/webparser) Optimized HTML parser for formatters
- [expression-parser](/packages/expression-parser) Framework agnostic template expression parser.
- [rehype-webparser](/packages/rehype-webparser) Adapter between HTML parser and rehype.
- [rehype-minify-whitespace](/packages/rehype-minify-whitespace) Collapse whitespace.
- [hast-util-from-parse](/packages/hast-util-from-webparser) Transform [webparser](/packages/webparser) AST to HAST.
