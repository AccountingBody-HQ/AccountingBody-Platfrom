import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'

export default defineConfig({
  name: 'accountingbody',
  title: 'AccountingBody',
  basePath: '/studio',

  projectId: '4rllejq1',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
  ],

  schema: {
    types: [],
  },
})
