import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import article      from './sanity/schemas/article'
import practicePost from './sanity/schemas/practicePost'
import quizbankQuiz  from './sanity/schemas/quizbankQuiz'
import quizbankBlock from './sanity/schemas/quizbankBlock'
import course       from './sanity/schemas/course'
import lesson       from './sanity/schemas/lesson'
import manualCard   from './sanity/schemas/manualCard'
import author       from './sanity/schemas/author'
import category     from './sanity/schemas/category'
import page         from './sanity/schemas/page'
import jobListing   from './sanity/schemas/jobListing'
import firmProfile  from './sanity/schemas/firmProfile'

const schemaTypes = [article, practicePost, quizbankQuiz, quizbankBlock, course, lesson, manualCard, page, author, category, jobListing, firmProfile]

const structure = (S: any) =>
  S.list().title('Content').items([
    S.listItem().title('Articles').child(S.documentTypeList('article').title('Articles')),
    S.listItem().title('Practice Posts').child(S.documentTypeList('practicePost').title('Practice Posts')),
    S.listItem().title('QuizBank Quizzes').child(S.documentTypeList('quizbankQuiz').title('QuizBank Quizzes')),
    S.divider(),
    S.listItem().title('Courses').child(S.documentTypeList('course').title('Courses')),
    S.listItem().title('Lessons').child(S.documentTypeList('lesson').title('Lessons')),
    S.divider(),
    S.listItem().title('Pages').child(S.documentTypeList('page').title('Pages')),
    S.listItem().title('Manual Cards').child(S.documentTypeList('manualCard').title('Manual Cards')),
    S.divider(),
    S.listItem().title('Job Listings').child(S.documentTypeList('jobListing').title('Job Listings')),
    S.listItem().title('Firm Profiles').child(S.documentTypeList('firmProfile').title('Firm Profiles')),
    S.divider(),
    S.listItem().title('Authors').child(S.documentTypeList('author').title('Authors')),
    S.listItem().title('Categories').child(S.documentTypeList('category').title('Categories')),
  ])

export default defineConfig({
  name: 'accountingbody',
  title: 'AccountingBody Studio',
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  plugins: [structureTool({ structure }), visionTool()],
  schema: { types: schemaTypes },
})
