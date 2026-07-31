import { executeQuery } from "../db/mssqlHelper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import Lesson from "../models/lesson.model.js";
import { normalizeElement, normalizeSlide } from "../utils/lessonNormalizers.js";

// Helper to normalize slides (moved logic inside respective functions or kept simple)
// Helper to parse JSON safely
const parseJSON = (data, fallback = []) => {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch (e) { return fallback; }
  }
  return data || fallback;
}

export const createLesson = asyncHandler(async (req, res) => {
  const rawModuleId = req.params?.moduleId ?? req.body?.moduleId;
  const { title, content, duration, order, slides } = req.body || {};

  if (!rawModuleId || rawModuleId === "undefined" || rawModuleId === "null") {
    throw new ApiError("Module ID is required", 400);
  }

  if (isNaN(rawModuleId)) {
    throw new ApiError("Invalid Module ID format. Expected an integer.", 400);
  }

  const [modules] = await executeQuery("SELECT id FROM modules WHERE id = ?", [rawModuleId]);
  if (modules.length === 0) throw new ApiError("Module not found", 404);

  // Normalize slides if provided
  let normalizedSlides = [];
  if (Array.isArray(slides)) {
    normalizedSlides = slides.map(normalizeSlide);
  }

  // Back-compat: if slides provided but content missing, set content from first slide
  const legacyContent = (content && content.trim().length > 0)
    ? content
    : (normalizedSlides[0]?.contentHtml || '');

  // Use Lesson.create to ensure slug generation and proper initialization
  const newLesson = await Lesson.create({
    module: rawModuleId,
    title,
    content: legacyContent,
    duration: duration || 0,
    order: order || 0,
    slides: normalizedSlides
  });

  const newLessonId = newLesson.id;
  const [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [newLessonId]);

  // Parse slides for response
  if (rows[0] && typeof rows[0].slides === 'string') rows[0].slides = parseJSON(rows[0].slides);

  res.status(201).json(new ApiResponse(201, rows[0], "Lesson created successfully"));
});

export const getLessonsByModule = asyncHandler(async (req, res) => {
  const rawModuleId = req.params?.moduleId ?? req.body?.moduleId;

  if (!rawModuleId || rawModuleId === 'undefined' || rawModuleId === 'null') {
    throw new ApiError("Module ID is required", 400);
  }

  // Check if module exists by ID or Slug
  let mRows;
  if (!isNaN(rawModuleId)) {
    [mRows] = await executeQuery("SELECT id FROM modules WHERE id = ? OR slug = ?", [rawModuleId, rawModuleId]);
  } else {
    [mRows] = await executeQuery("SELECT id FROM modules WHERE slug = ?", [rawModuleId]);
  }
  if (mRows.length === 0) throw new ApiError("Module not found", 400);
  const moduleId = mRows[0].id;

  const [lessons] = await executeQuery("SELECT * FROM lessons WHERE module = ? ORDER BY [order] ASC", [moduleId]);

  // Normalize
  const normalized = lessons.map(l => {
    let slides = parseJSON(l.slides);
    if ((!slides || slides.length === 0) && l.content) {
      slides = [{
        order: 1,
        contentHtml: String(l.content || ''),
        bgColor: '#ffffff',
        images: [],
        _id: `${Date.now()}-legacy`
      }];
    }
    return { ...l, slides };
  });

  res.status(200).json(new ApiResponse(200, normalized, "Lessons fetched successfully"));
});

export const getLessonById = asyncHandler(async (req, res) => {
  const rawLessonId = req.params?.lessonId ?? req.body?.lessonId;

  if (!rawLessonId || rawLessonId === 'undefined' || rawLessonId === 'null') {
    throw new ApiError("Lesson ID is required", 400);
  }

  let rows;
  if (!isNaN(rawLessonId)) {
    [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ? OR slug = ?", [rawLessonId, rawLessonId]);
  } else {
    [rows] = await executeQuery("SELECT * FROM lessons WHERE slug = ?", [rawLessonId]);
  }

  if (rows.length === 0) throw new ApiError("Lesson not found", 404);

  const lesson = rows[0];
  lesson.slides = parseJSON(lesson.slides);

  if (!Array.isArray(lesson.slides) || lesson.slides.length === 0) {
    lesson.slides = lesson.content
      ? [{ order: 1, contentHtml: String(lesson.content || ''), bgColor: '#ffffff', images: [], _id: `${Date.now()}-legacy` }]
      : [];
  }

  res.status(200).json(new ApiResponse(200, lesson, "Lesson fetched successfully"));
});

export const updateLesson = asyncHandler(async (req, res) => {
  const rawLessonId = req.params?.lessonId ?? req.body?.lessonId;
  const { title, content, duration, order, slides } = req.body || {};

  if (!rawLessonId) throw new ApiError("Lesson ID is required", 400);

  const [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [rawLessonId]);
  if (rows.length === 0) throw new ApiError("Lesson not found", 404);
  const existing = rows[0];

  let updateFields = [];
  let updateValues = [];

  if (typeof title !== 'undefined') { updateFields.push("title = ?"); updateValues.push(title); }
  if (typeof content !== 'undefined') { updateFields.push("content = ?"); updateValues.push(content); }
  if (typeof duration !== 'undefined') { updateFields.push("duration = ?"); updateValues.push(duration); }
  if (typeof order !== 'undefined') { updateFields.push("[order] = ?"); updateValues.push(order); }

  if (Array.isArray(slides)) {
    const normalizedSlides = slides.map(normalizeSlide);
    updateFields.push("slides = ?");
    updateValues.push(JSON.stringify(normalizedSlides));

    // Back-compat content update
    if (!content && (!existing.content || existing.content.trim().length === 0)) {
      const legacy = normalizedSlides[0]?.contentHtml || '';
      // Check if content already added to updates
      const contentIdx = updateFields.indexOf("content = ?");
      if (contentIdx === -1) {
        updateFields.push("content = ?");
        updateValues.push(legacy);
      } else {
        updateValues[contentIdx] = legacy;
      }
    }
  }

  if (updateFields.length > 0) {
    updateFields.push("updatedAt = GETDATE()");
    await executeQuery(`UPDATE lessons SET ${updateFields.join(', ')} WHERE id = ?`, [...updateValues, rawLessonId]);
  }

  // Return updated
  const [updatedRows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [rawLessonId]);
  const updated = updatedRows[0];
  updated.slides = parseJSON(updated.slides);

  res.status(200).json(new ApiResponse(200, updated, "Lesson updated successfully"));
});

export const deleteLesson = asyncHandler(async (req, res) => {
  const rawLessonId = req.params?.lessonId ?? req.body?.lessonId;

  if (!rawLessonId) throw new ApiError("Lesson ID is required", 400);

  const [result, metadata] = await executeQuery("DELETE FROM lessons WHERE id = ?", [rawLessonId]);
  if (metadata.affectedRows === 0) throw new ApiError("Lesson not found", 404);

  res.status(200).json(new ApiResponse(200, null, "Lesson deleted successfully"));
});

// Slide-level operations

export const addSlide = asyncHandler(async (req, res) => {
  const rawLessonId = req.params?.lessonId ?? req.body?.lessonId;
  const { contentHtml = '', bgColor = '#ffffff', images = [], order, elements = [] } = req.body || {};

  if (!rawLessonId) throw new ApiError("Lesson ID is required", 400);

  const [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [rawLessonId]);
  if (rows.length === 0) throw new ApiError("Lesson not found", 404);
  const lesson = rows[0];

  const currentSlides = parseJSON(lesson.slides);

  const newOrder = typeof order === 'number' ? order : (currentSlides.length || 0) + 1;
  const slide = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    _id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    order: newOrder,
    contentHtml: String(contentHtml || ''),
    bgColor: bgColor || '#ffffff',
    images: Array.isArray(images) ? images.map(img => ({ url: img.url, public_id: img.public_id, alt: img.alt || '' })) : [],
    elements: Array.isArray(elements) ? elements.map(normalizeElement) : [],
  };

  const newSlides = [...currentSlides, slide].sort((a, b) => (a.order || 0) - (b.order || 0)).map((s, i) => ({ ...s, order: i + 1 }));

  await executeQuery("UPDATE lessons SET slides = ?, updatedAt = GETDATE() WHERE id = ?", [JSON.stringify(newSlides), rawLessonId]);

  // Return updated lesson
  lesson.slides = newSlides;
  res.status(201).json(new ApiResponse(201, lesson, "Slide added"));
});

export const updateSlide = asyncHandler(async (req, res) => {
  const rawLessonId = req.params?.lessonId ?? req.body?.lessonId;
  const slideId = req.params?.slideId ?? req.body?.slideId;
  const { contentHtml, bgColor, images, order, elements } = req.body || {};

  if (!rawLessonId) throw new ApiError("Lesson ID is required", 400);
  if (!slideId) throw new ApiError("Slide ID is required", 400);

  const [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [rawLessonId]);
  if (rows.length === 0) throw new ApiError("Lesson not found", 404);
  const lesson = rows[0];

  let slides = parseJSON(lesson.slides);
  const sIdx = slides.findIndex(s => String(s._id || s.id) === String(slideId));

  if (sIdx === -1) throw new ApiError("Slide not found", 404);

  if (typeof contentHtml !== 'undefined') slides[sIdx].contentHtml = String(contentHtml || '');
  if (typeof bgColor !== 'undefined') slides[sIdx].bgColor = bgColor || '#ffffff';
  if (Array.isArray(images)) slides[sIdx].images = images.map(img => ({ url: img.url, public_id: img.public_id, alt: img.alt || '' }));
  if (Array.isArray(elements)) slides[sIdx].elements = elements.map(normalizeElement);
  if (typeof order === 'number') slides[sIdx].order = order;

  // Normalize order
  slides = slides.sort((a, b) => (a.order || 0) - (b.order || 0)).map((s, i) => ({ ...s, order: i + 1 }));

  await executeQuery("UPDATE lessons SET slides = ?, updatedAt = GETDATE() WHERE id = ?", [JSON.stringify(slides), rawLessonId]);

  lesson.slides = slides;
  res.status(200).json(new ApiResponse(200, lesson, "Slide updated"));
});

export const deleteSlide = asyncHandler(async (req, res) => {
  const rawLessonId = req.params?.lessonId ?? req.body?.lessonId;
  const slideId = req.params?.slideId ?? req.body?.slideId;

  if (!rawLessonId) throw new ApiError("Lesson ID is required", 400);
  if (!slideId) throw new ApiError("Slide ID is required", 400);

  const [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [rawLessonId]);
  if (rows.length === 0) throw new ApiError("Lesson not found", 404);
  const lesson = rows[0];

  let slides = parseJSON(lesson.slides);
  const filtered = slides.filter(s => String(s._id || s.id) !== String(slideId));
  const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));

  await executeQuery("UPDATE lessons SET slides = ?, updatedAt = GETDATE() WHERE id = ?", [JSON.stringify(reordered), rawLessonId]);

  lesson.slides = reordered;
  res.status(200).json(new ApiResponse(200, lesson, "Slide deleted"));
});

export const reorderSlides = asyncHandler(async (req, res) => {
  const rawLessonId = req.params?.lessonId ?? req.body?.lessonId;
  const { order = [], slides: slidesOrder = [] } = req.body || {};

  if (!rawLessonId) throw new ApiError("Lesson ID is required", 400);

  const [rows] = await executeQuery("SELECT * FROM lessons WHERE id = ?", [rawLessonId]);
  if (rows.length === 0) throw new ApiError("Lesson not found", 404);
  const lesson = rows[0];

  const current = parseJSON(lesson.slides);
  if (!current.length) return res.status(200).json(new ApiResponse(200, lesson, "No slides to reorder"));

  let newOrderIds = [];
  if (Array.isArray(order) && order.length) {
    newOrderIds = order.map(id => String(id));
  } else if (Array.isArray(slidesOrder) && slidesOrder.length) {
    newOrderIds = slidesOrder.sort((a, b) => (a.order || 0) - (b.order || 0)).map(s => String(s._id || s.id));
  } else {
    throw new ApiError("Provide 'order' as array of slideIds or 'slides' with {_id, order}", 400);
  }

  const byId = new Map(current.map(s => [String(s._id || s.id), s]));
  const reordered = newOrderIds.map(id => byId.get(id)).filter(Boolean);

  if (reordered.length !== current.length) {
    // Fallback: If partial reordering or mismatches, might want to error, 
    // but simple logic suggests ignoring invalid IDs or not changing if lengths mismatch
    throw new ApiError("Order does not include all slides or invalid IDs", 400);
  }

  const finalSlides = reordered.map((s, i) => ({ ...s, order: i + 1 }));

  await executeQuery("UPDATE lessons SET slides = ?, updatedAt = GETDATE() WHERE id = ?", [JSON.stringify(finalSlides), rawLessonId]);

  lesson.slides = finalSlides;
  res.status(200).json(new ApiResponse(200, lesson, "Slides reordered"));
});
