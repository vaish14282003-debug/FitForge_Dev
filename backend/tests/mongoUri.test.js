const Joi = require('joi');
const { cleanMongoUri, explainMongoUri } = require('../src/config/mongoUri');

const uri = Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] });
const GOOD = 'mongodb+srv://fitforge-prod:Kx7Tq2LmZ9vB@cluster0.abc.mongodb.net/fitforge_prod?retryWrites=true&w=majority';

describe('MONGO_URI cleanup', () => {
  it.each([
    ['leading/trailing whitespace and newline', `  ${GOOD}\n`],
    ['double quotes', `"${GOOD}"`],
    ['single quotes', `'${GOOD}'`],
    ['pasted key prefix', `MONGO_URI=${GOOD}`],
    ['key prefix and quotes', `MONGO_URI = "${GOOD}"`],
  ])('forgives %s', (_name, raw) => {
    expect(cleanMongoUri(raw)).toBe(GOOD);
    expect(uri.validate(cleanMongoUri(raw)).error).toBeUndefined();
  });

  it('leaves a correct string alone', () => expect(cleanMongoUri(GOOD)).toBe(GOOD));
});

describe('MONGO_URI explanations never include the password', () => {
  const secret = 'S3cr3tPass';
  it.each([
    ['angle brackets', `mongodb+srv://fitforge-prod:<${secret}>@cluster0.abc.mongodb.net/db`, /< or >/],
    ['@ in password', `mongodb+srv://fitforge-prod:${secret}@x@cluster0.abc.mongodb.net/db`, /symbol/],
    ['# in password', `mongodb+srv://fitforge-prod:${secret}#x@cluster0.abc.mongodb.net/db`, /symbol/],
    ['space inside', `mongodb+srv://fitforge-prod:${secret}@cluster0.abc.mongodb .net/db`, /space/],
    ['wrong scheme', `mongo+srv://fitforge-prod:${secret}@cluster0.abc.mongodb.net/db`, /must start with/],
  ])('%s', (_name, value, expected) => {
    expect(uri.validate(value).error).toBeDefined();
    const message = explainMongoUri(value);
    expect(message).toMatch(expected);
    expect(message).not.toContain(secret);
  });
});
