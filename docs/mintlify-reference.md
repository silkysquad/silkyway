# Mintlify Documentation Reference Guide

This guide synthesizes key information from the Mintlify documentation for quick reference when creating docs.

## Core Configuration

### docs.json Structure

```json
{
  "$schema": "https://mintlify.com/docs.json",
  "name": "Project Name",
  "logo": {
    "light": "/logo/light.svg",
    "dark": "/logo/dark.svg"
  },
"favicon": "/favicon.svg",Z
  "colors": {
    "light": "#07C983",
    "dark": "#15803D"
  },
  "navigation": {
    "tabs": [
      {
        "tab": "Tab Name",
        "groups": [
          {
            "group": "Group Name",
            "pages": ["page-path"]
          }
        ]
      }
    ]
  },
  "navbar": {
    "links": [{ "label": "Label", "href": "url" }],
    "primary": {
      "type": "button",
      "label": "CTA Text",
      "href": "url"
    }
  },
  "footer": {
    "socials": {
      "x": "https://x.com/...",
      "github": "https://github.com/...",
      "linkedin": "https://linkedin.com/..."
    }
  }
}
```

### Page Frontmatter

```mdx
---
title: 'Page Title'
description: 'Page description for SEO'
icon: 'icon-name'  # Font Awesome icon
---
```

## Component Library

### Cards

Single card:

```mdx
<Card
  title="Card Title"
  icon="icon-name"
  href="/path/to/page"
  horizontal  # Optional: makes card horizontal
>
  Card description text
</Card>
```

Card groups (multiple columns):

```mdx
<CardGroup cols={2}>
  <Card title="Card 1" icon="icon" href="/path1">
    Description 1
  </Card>
  <Card title="Card 2" icon="icon" href="/path2">
    Description 2
  </Card>
</CardGroup>

# Also supports: <Columns cols={2}>...</Columns>
```

### Callouts

```mdx
<Note>
  This is a note callout
</Note>

<Tip>
  This is a tip callout
</Tip>

<Warning>
  This is a warning callout
</Warning>

<Info>
  This is an info callout
</Info>
```

### Code Blocks

Inline code:

```mdx
Use backticks for `inline code`
```

Code blocks with syntax highlighting:

````mdx
```typescript filename.ts
const example = "code";
```
````

Code groups (tabs for multiple languages):

````mdx
<CodeGroup>
```typescript TypeScript
const example = "TypeScript";
```

```javascript JavaScript
const example = "JavaScript";
```

```bash cURL
curl https://api.example.com
```
</CodeGroup>
````

### Accordions

```mdx
<Accordion title="Accordion Title">
  Content inside accordion
</Accordion>

<AccordionGroup>
  <Accordion title="First" icon="icon-name">
    First content
  </Accordion>
  <Accordion title="Second">
    Second content
  </Accordion>
</AccordionGroup>
```

### Tabs

```mdx
<Tabs>
  <Tab title="Tab 1">
    Content for tab 1
  </Tab>
  <Tab title="Tab 2">
    Content for tab 2
  </Tab>
</Tabs>
```

### Steps

```mdx
<Steps>
<Step title="First Step">
  Content for first step
</Step>

<Step title="Second Step">
  Content for second step
</Step>
</Steps>
```

### Frames (for images/embeds)

```mdx
<Frame>
  <img src="/path/to/image.png" alt="Description" />
</Frame>
```

### API Components

For API documentation pages:

```mdx
<ParamField path="paramName" type="string" required>
  Parameter description
</ParamField>

<ResponseField name="fieldName" type="string">
  Response field description
</ResponseField>

<Expandable title="Nested Fields">
  <ResponseField name="nested" type="object">
    Nested field description
  </ResponseField>
</Expandable>
```

### API Endpoint Pages (OpenAPI)

For auto-generated API docs from OpenAPI spec:

```mdx
---
title: 'Endpoint Name'
openapi: 'GET /api/endpoint'
---

Optional additional content below will be shown alongside the auto-generated API playground.
```

## Navigation Best Practices

1. **Folder Structure**: Use folders to organize pages logically
    - `guides/` for conceptual documentation
    - `api-reference/` for API documentation
    - `use-cases/` for examples and tutorials

2. **Page Paths**: Use kebab-case for URLs
    - `guides/how-it-works.mdx` → `/guides/how-it-works`
    - Don't include `.mdx` in navigation paths

3. **Tabs vs Groups**:
    - Tabs for major sections (Guides, API Reference)
    - Groups for subsections within tabs

4. **Hidden Pages**: Pages not in `docs.json` are searchable but not in sidebar

## Markdown Syntax

### Text Formatting

- **Bold**: `**text**`
- *Italic*: `_text_`
- ~Strikethrough~: `~text~`
- Superscript: `<sup>text</sup>`
- Subscript: `<sub>text</sub>`

### Links

Internal (root-relative):

```md
[Link Text](/guides/page-name)
```

External:

```md
[Link Text](https://example.com)
```

### Images

Markdown:

```md
![Alt text](/path/image.jpg)
```

HTML (for more control):

```html
<img src="/path/image.jpg" height="200" style={{ borderRadius: '0.5rem' }} />
```

### Lists

Unordered:

```md
- Item 1
- Item 2
  - Nested item
```

Ordered:

```md
1. First
2. Second
3. Third
```

### Blockquotes

```md
> This is a blockquote
>
> Multi-line blockquote
```

### Tables

```md
| Column 1 | Column 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

## Reusable Snippets

Create reusable content in `/snippets/` directory:

**snippets/example.mdx**:

```mdx
export const myVariable = "value";

This is reusable content with {props.dynamicValue}.
```

**Usage in page**:

```mdx
import ExampleSnippet from '/snippets/example.mdx';
import { myVariable } from '/snippets/example.mdx';

<ExampleSnippet dynamicValue="custom value" />

Variable: {myVariable}
```

## OpenAPI Integration

### Configuration in docs.json

```json
{
  "openapi": "/path/to/openapi.json",
  "api": {
    "baseUrl": "https://api.example.com",
    "auth": {
      "method": "bearer",
      "name": "Authorization"
    },
    "playground": {
      "mode": "show"  // or "simple" or "hide"
    }
  }
}
```

### Creating API Pages

Two methods:

1. **Auto-generated** (from OpenAPI):

```mdx
---
title: 'Get User'
openapi: 'GET /users/{id}'
---
```

2. **Manual** (using components):

```mdx
---
title: 'Get User'
---

## GET /users/{id}

<ParamField path="id" type="string" required>
  User ID
</ParamField>

<ResponseField name="id" type="string">
  User ID
</ResponseField>
```

## Development Workflow

### Local Preview

```bash
# Install CLI
npm i -g mint

# Run dev server
cd /path/to/docs
mint dev

# Custom port
mint dev --port 3333

# Check for broken links
mint broken-links

# Update CLI
npm update mint
```

Preview runs at `http://localhost:3000` with hot reload.

## Best Practices

### Content Organization

1. **Start with "why"**: Explain value before diving into details
2. **Progressive disclosure**: Basic info first, advanced topics later
3. **Examples everywhere**: Code examples for every concept
4. **Multiple learning paths**: Quickstart for speed, deep dives for understanding

### Writing Style

1. **Active voice**: "Deploy your first operation" not "Operations can be deployed"
2. **Short paragraphs**: 2-3 sentences max
3. **Scannable**: Use headings, bullets, callouts
4. **Code-first**: Show code examples before lengthy explanations

### Component Usage

1. **Cards for navigation**: Use Card/CardGroup for guiding next steps
2. **Tabs for alternatives**: Different languages, different approaches
3. **Accordions for optional detail**: Keep page scannable, hide complexity
4. **Callouts for emphasis**: Note, Tip, Warning, Info for key points
5. **Steps for processes**: Multi-step tutorials and setup guides

### API Documentation

1. **Consistent format**: All endpoints follow same structure
2. **Real examples**: Use actual request/response data
3. **Error cases**: Document common errors and solutions
4. **Rate limits**: Clearly state any limits
5. **Authentication**: Show how to authenticate every request

## Common Patterns

### Homepage Structure

```mdx
# Welcome to [Product]

## [Value Proposition]

Brief description of what the product does.

### What We Do

- Bullet points of key capabilities
- Focus on benefits, not features

### Who It's For

- Target audience 1
- Target audience 2

<CardGroup cols={2}>
  <Card title="Quick Start" href="/quickstart">
    Get started in 5 minutes
  </Card>
  <Card title="How It Works" href="/how-it-works">
    Understand the architecture
  </Card>
</CardGroup>
```

### Integration Guide Structure

```mdx
# [Integration Type]

## Prerequisites

- Requirement 1
- Requirement 2

<Steps>
<Step title="Setup">
  Setup instructions
</Step>

<Step title="Configure">
  Configuration steps
</Step>

<Step title="Test">
  Testing steps
</Step>
</Steps>

## Next Steps

<CardGroup>
  <Card title="API Reference" href="/api">
    View API documentation
  </Card>
</CardGroup>
```

### Use Case Structure

```mdx
# Use Case: [Name]

## The Opportunity

Describe the business problem/opportunity.

## Implementation Pattern

### Architecture

Diagram or description of the pattern.

### Integration Example

<CodeGroup>
```typescript
// Example code
```

```bash
# cURL example
```

</CodeGroup>

## Quick Implementation

- Week 1: ...
- Week 2: ...

```

## File Structure Example

```

/docs
├── docs.json
├── index.mdx (homepage)
├── quickstart.mdx
├── guides/
│ ├── how-it-works.mdx
│ ├── concepts/
│ │ └── operations.mdx
│ ├── integration/
│ │ ├── authentication.mdx
│ │ └── custody-adapters.mdx
│ └── use-cases/
│ ├── wallet-providers.mdx
│ └── payment-processors.mdx
├── api-reference/
│ ├── introduction.mdx
│ ├── openapi.json
│ └── endpoints/
│ ├── operations.mdx
│ └── wallets.mdx
├── snippets/
│ └── common-callouts.mdx
├── images/
│ ├── flow-diagram.svg
│ └── architecture.png
└── logo/
├── light.svg
└── dark.svg

```

## Tips & Tricks

1. **Icons**: Use Font Awesome icons (e.g., `icon="rocket"`, `icon="code"`)
2. **Formatting**: MDX supports HTML, so use `<br />` for spacing
3. **Embeds**: iframes work for videos and external content
4. **LaTeX**: Use `<Latex>formula</Latex>` for math equations
5. **Contextual options**: Enable copy, ChatGPT, Claude, etc. in `docs.json`
6. **Anchors**: Every ## and ### creates an anchor for linking
7. **Search**: Built-in search is automatic, no configuration needed
8. **Versioning**: Use `versions` field in docs.json for multiple doc versions

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [Font Awesome Icons](https://fontawesome.com/search)
- [MDX Syntax](https://mdxjs.com/)
- [OpenAPI Specification](https://swagger.io/specification/)
