const ClientNote = require('../models/ClientNote');
const ApiError = require('../utils/ApiError');
const { PERMISSIONS, can } = require('../config/roles');
const { findClient } = require('../utils/scope');

async function listNotes(req, res) {
  const member = await findClient(req.user, req.valid.params.id);
  const notes = await ClientNote.find({ member: member._id }).populate('author', 'name avatarKey').sort({ createdAt: -1 }).limit(100);
  res.json({ notes });
}

async function addNote(req, res) {
  const member = await findClient(req.user, req.valid.params.id);
  const note = await ClientNote.create({ gym: req.user.gym, member: member._id, author: req.user._id, body: req.valid.body.body });
  await note.populate('author', 'name avatarKey');
  res.status(201).json({ note });
}

// Authors delete their own notes; owners can delete any in the gym.
async function deleteNote(req, res) {
  const filter = { _id: req.valid.params.noteId, gym: req.user.gym };
  if (!can(req.user.role, PERMISSIONS.GYM_SETTINGS)) filter.author = req.user._id;
  const { deletedCount } = await ClientNote.deleteOne(filter);
  if (!deletedCount) throw ApiError.notFound('Note not found');
  res.status(204).end();
}

module.exports = { listNotes, addNote, deleteNote };
