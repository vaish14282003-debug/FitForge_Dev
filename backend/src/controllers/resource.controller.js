const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');
const Resource = require('../models/Resource');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES, PERMISSIONS, can } = require('../config/roles');
const { storage, removeQuietly, gymPrefix } = require('../storage');
const { notify } = require('../services/notify');

const isOwnerLevel = (user) => can(user.role, PERMISSIONS.GYM_SETTINGS);

/** Checks the bytes really are the type claimed, so a renamed file can't slip through. */
async function assertRealFile(file) {
  if (file.mimetype === 'application/pdf') {
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw ApiError.badRequest('That file is not a valid PDF.');
    return;
  }
  try {
    const meta = await sharp(file.buffer).metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error();
  } catch {
    throw ApiError.badRequest('That file is not a readable image.');
  }
}

// Members see resources from their trainer that are shared with all clients or with them;
// trainers see their own; owners see the whole gym's.
async function scopeFor(user) {
  if (isOwnerLevel(user)) return { gym: user.gym };
  if (user.role === ROLES.TRAINER) return { gym: user.gym, owner: user._id };
  const or = [{ sharedWith: user._id }];
  if (user.trainer) or.push({ owner: user.trainer, shareWithAllClients: true });
  return { gym: user.gym, $or: or };
}

async function recipientsOf(resource) {
  if (resource.shareWithAllClients) return User.find({ gym: resource.gym, role: ROLES.MEMBER, trainer: resource.owner, isActive: true }).distinct('_id');
  return resource.sharedWith;
}

async function listResources(req, res) {
  const resources = await Resource.find(await scopeFor(req.user)).populate('owner', 'name avatarKey').sort({ createdAt: -1 }).limit(200);
  res.json({ resources });
}

async function createResource(req, res) {
  const { title, description, memberIds } = req.valid.body;
  await assertRealFile(req.file);

  // Explicit recipients must be the uploader's own clients (any member, for owners).
  let shareWithAllClients = true;
  let sharedWith = [];
  if (memberIds?.length) {
    const filter = { _id: { $in: memberIds }, gym: req.user.gym, role: ROLES.MEMBER };
    if (!isOwnerLevel(req.user)) filter.trainer = req.user._id;
    sharedWith = await User.find(filter).distinct('_id');
    if (sharedWith.length !== memberIds.length) throw ApiError.badRequest('You can only share with your own clients');
    shareWithAllClients = false;
  } else if (isOwnerLevel(req.user)) {
    throw ApiError.badRequest('Choose who to share this with');
  }

  const ext = req.file.mimetype === 'application/pdf' ? '.pdf' : path.extname(req.file.originalname).toLowerCase() || '';
  const key = `${gymPrefix(req.user.gym)}resources/${crypto.randomUUID()}${ext}`;
  await storage.put(key, req.file.buffer, req.file.mimetype);
  const resource = await Resource.create({
    gym: req.user.gym,
    owner: req.user._id,
    title,
    description,
    fileKey: key,
    fileName: path.basename(req.file.originalname).slice(0, 200),
    mimeType: req.file.mimetype,
    size: req.file.size,
    shareWithAllClients,
    sharedWith,
  });

  await notify(await recipientsOf(resource), {
    gym: req.user.gym,
    type: 'RESOURCE_SHARED',
    title: `${req.user.name.split(' ')[0]} shared "${title}"`,
    body: description,
    actor: req.user._id,
    link: '/workouts#resources',
  });
  await resource.populate('owner', 'name avatarKey');
  res.status(201).json({ resource });
}

async function downloadResource(req, res) {
  const resource = await Resource.findOne({ _id: req.valid.params.id, ...(await scopeFor(req.user)) });
  if (!resource) throw ApiError.notFound('File not found');
  const disposition = `${req.query.download ? 'attachment' : 'inline'}; filename="${resource.fileName.replace(/[^\w.\- ]/g, '_')}"`;

  if (storage.driver === 's3') {
    const url = await storage.signedUrl(resource.fileKey);
    if (!url) throw ApiError.notFound('File not found');
    res.set('Cache-Control', 'no-store');
    return res.redirect(302, url);
  }
  const file = await storage.locate(resource.fileKey);
  if (!file) throw ApiError.notFound('File not found');
  res.set({ 'Content-Type': resource.mimeType, 'Content-Disposition': disposition, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
  res.sendFile(file);
}

async function deleteResource(req, res) {
  const filter = { _id: req.valid.params.id, gym: req.user.gym };
  if (!isOwnerLevel(req.user)) filter.owner = req.user._id;
  const resource = await Resource.findOneAndDelete(filter);
  if (!resource) throw ApiError.notFound('File not found');
  await removeQuietly(resource.fileKey);
  res.status(204).end();
}

module.exports = { listResources, createResource, downloadResource, deleteResource };
