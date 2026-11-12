# Instructor Guide: Importing Course Content from Word

Learnpedia's course importer lets you prepare course content in Microsoft Word, preview it, and add it to Learnpedia without creating every module and lesson by hand.

## Get started

1. Sign in to Learnpedia with your instructor account.
2. Open **Admin CMS → Courses**.
3. Select **Download Word template** and open the downloaded file in Microsoft Word.
4. Replace every bracketed example with your course content. The importer accepts Word Heading styles or Markdown headings (`#`, `##`, and `###`), so pasted Markdown headings work too. Remove any introductory text before the course title.
5. Save the finished document as a `.docx` file.
6. Return to **Admin CMS → Courses**, upload the file, and review the preview and any validation messages before importing.

The Word file must be no larger than 5 MB.

## Required document structure

Use this structure in Word:

- **Heading 1 or `#`:** Course title
- **Normal paragraph:** `Description: Your course description`
- **Heading 2 or `##`:** `Module 1: Module title`
- **Heading 3 or `###`:** `Lesson 1: Lesson title`
- **Normal paragraphs and formatted lists:** Lesson explanation

Repeat the module and lesson headings as needed. One module is enough for an import; each module must contain at least one lesson, and each lesson needs explanation content. Blank lines between sections are okay.

### Example

```text
[Heading 1] Basic Biology
Description: An introduction to cells and living things.

[Heading 2] Module 1: Introduction to Cells
[Heading 3] Lesson 1: What Is a Cell?
Cells are the basic units of life. In this lesson, we will explore their main parts.

[Heading 3] Lesson 2: Cell Structures
The cell membrane surrounds the cell and helps regulate what enters and leaves it.

[Heading 2] Module 2: Living Things
[Heading 3] Lesson 1: Characteristics of Life
Living things share several characteristics, including growth and reproduction.
```

The bracketed labels above describe Word styles; do not type `[Heading 1]` into the document. Apply the corresponding Heading style using Word's style controls, or use the Markdown `#` prefix shown above. If you paste Markdown, use one, two, or three `#` characters for the course, module, and lesson headings respectively. Markdown bold such as `**important**` is preserved as bold in lesson explanations.

The importer ignores ordinary text before the first course-title heading. Put the course title first anyway, and do not leave `[Course Title]` or other bracketed placeholders in the document.

### Worked example

```markdown
# Basic Biology
Description: An introduction to cells and living things.

## Module 1: Introduction to Cells
### Lesson 1: What Is a Cell?
Cells are the **basic units of life**. They make up every living thing.

Image: https://example.com/cell-diagram.jpg

### Lesson 2: Cell Structures
The cell membrane surrounds the cell and helps regulate what enters and leaves it.
```

This example has one module with two lessons. You can also download the Word template in Admin CMS → Courses and replace its sample text.

## Add images and videos

Add a media link on its own line inside the lesson explanation, in the place where it should appear:

```text
Cells contain structures that perform different jobs.
Image: https://example.com/cell-diagram.jpg
The nucleus contains the cell's genetic material.
Video: https://www.youtube.com/watch?v=VIDEO_ID
```

- **Images:** Use an HTTP or HTTPS link to an image that learners can access. The image is inserted into the explanation at that position. Embedded images pasted into the Word document are not supported.
- **Videos:** Use a YouTube video link. Up to five videos are supported per lesson.
- **Audio links, non-YouTube videos, quizzes, flashcards, and H5P embeds** are not supported by this importer.
- Add quizzes separately using Learnpedia's existing quiz workflow.

## Create a new course or add to an existing one

In the import panel, choose one of these options:

- **Create a new course:** Leave the existing-course selector on **Create a new course**. The import creates an unpublished draft course assigned to your account.
- **Add to an existing course:** Select a course you are authorized to manage. The import appends the document's modules and lessons after the course's existing modules. It does not replace existing content or change the course title or description.

You can append content to a published course. **New content added to a published course may be available to learners as soon as the import completes**, so confirm the selected course and review the preview carefully before importing.

When adding another batch to a course, number the modules in that document starting from `Module 1` again. Learnpedia will assign them the next module numbers in the selected course. Lesson numbering starts from `Lesson 1` within each module.

## Before you import

- Check the course title, description, module names, lesson names, and lesson order in the preview.
- Confirm that every image and video link is correct and accessible.
- If adding to an existing course, double-check the selected course. Its title and description will not be replaced by the document's values.
- Fix all validation errors shown in the panel before importing.
- After importing, open the course in the CMS and review its modules and lessons. Add quizzes separately where needed.

The importer creates or appends course structure and lesson content; it does not publish a new course automatically.

## Preview the course as a student

After adding or editing modules, open **Admin CMS → Modules**, select the course, and click **View as student**. This opens the course player with all modules available so you can check the learner experience before publishing.

Preview mode is read-only for learner progress: module completion and quiz attempts are not saved. You can still answer quiz questions to check the quiz flow. Use **Back to course management** to return to the CMS.

For published courses, preview includes any existing live content, so remember that learners may already be accessing the course while you make changes.
