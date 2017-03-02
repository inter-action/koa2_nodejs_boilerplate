import 'reflect-metadata';
import {
    Entity, Column, PrimaryGeneratedColumn,
    CreateDateColumn, UpdateDateColumn, getConnectionManager
} from 'typeorm';
import * as uuidV4 from 'uuid/v4';
import * as crypto from 'crypto';
import * as assert from 'assert';


import * as validator from 'validator';
import * as _ from 'lodash';
import * as Bluebird from 'bluebird';
import * as boom from 'boom';

import { errors, ENV_UTILS } from '../utils';
import { Either, Left, Right } from '../extend_type';
const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt');
const saltRounds = 10;
const bcryptCreateHash: any = Bluebird.promisify(bcrypt.hash);
const bcryptCompare: any = Bluebird.promisify(bcrypt.compare);
const jwtSign: any = Bluebird.promisify(jwt.sign);

/*
add validation

        // only validate model, the ultimate result to be persisted into database
        // view model you do it in your controller
        validate: function (user: DBUser) {
            let result = booleanChain<DBUser>(e => {
                return _.isString(e.username) &&
                    validator.isLength(e.username, { min: 0 }) &&
                    validator.matches(e.username, /^[a-z-_0-9]+$/i)
            })
                .map(e => _.isString(e.email) && validator.isEmail(e.email))
                .map(e => _.isString(e.password))
                .map(e => _.isString(e.uuid))
                .run(user);

            return result;
        },

*/

@Entity()
export class User {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 36 })
    uuid: string = uuidV4();

    @Column({ length: 25 })
    username: string;

    @Column()
    password: string;

    @Column({ length: 50 })
    email: string;

    @Column({ length: 50 })
    from: string = 'this_app';

    @Column()
    fromId: string = '';

    @Column('smallint')
    status: number = 0;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    static create(username: string, email: string, password: string) {
        let usr = new User();
        usr.username = username
        usr.email = email
        usr.password = password
        return usr;
    }

    static convertUser(optionUser: UserKey) {
        let user = new User();
        Object.assign(user, optionUser);
        return user;
    }

    // return Promise<password: string>
    static createHashPr(password: string) {
        return bcryptCreateHash(password, saltRounds);
    }

    /*
    find user , compare password, if not match return null else return user
    @return Promise<user|null, null>
    */
    static async loginPr(email, password) {
        let model = await getUserAccess().findOne({ email })
        if (!model) return null;
        let ismatch = await bcryptCompare(password, model.password);
        if (ismatch) {
            delete model.password
            return model
        } else {
            return null;
        }
    }

    static validateUserView(user: UserKey): errors.ValidationError | null {
        if (!(_.isString(user.username) &&
            validator.isLength(user.username, { min: 0 }) &&
            validator.matches(user.username, /^[a-z-_0-9]+$/i))) {
            return new errors.ValidationError('username is invalid')
        }

        if (!(_.isString(user.email) && validator.isEmail(user.email))) {
            return new errors.ValidationError('email is invalid')
        }

        if (!(_.isString(user.password) && validator.isLength(user.password as any, { min: 8 }))) {
            return new errors.ValidationError('password is invalid')
        }

        return null
    }

    // return a JWT token
    static async createTokenPr(user: User) {
        return await jwtSign({ uuid: user.uuid }, ENV_UTILS.getEnvConfig('JWT_SIGNED_TOKEN'), {})
    }


    static async generateResetToken(expireMili: number, email: string): Promise<Either<Error, string>> {
        let model = await getUserAccess().findOne({ email });
        if (!model) return new Left<Error, string>(boom.badRequest('invalid email'));
        return new Right<Error, string>(resetToken.generateResetToken(expireMili, email, model.password));
    }

    static async validateResetTokenPr(token: string): Promise<Either<Error, User>> {
        let findUserByEmail = async (email) => {
            // todo: findOnePr should exclude password info by default
            let user = await getUserAccess().findOne({ email });
            assert(user != null, 'token find user by email return null')
            return user
        };

        try {
            let result = await resetToken.validateResetToken(token, findUserByEmail)

            if (result.isLeft()) {
                return new Left<Error, User>(boom.badRequest(result.getLeft().message));
            }
            return result
        } catch (error) {
            return new Left<Error, User>(boom.badRequest(error.message));
        }
    }


}


type UserKey = {[P in keyof User]?: User[P]}

export function getUserAccess() {
    const resp = getConnectionManager().get().getRepository(User);

    return {
        getRespsitory() {
            return resp;
        },

        findOne(options: UserKey) {
            return resp.findOne(options);
        }
    }
}


export const resetToken = {
    generateResetToken(expireMili: number, email: string, password: string, appname = 'app'): string {
        function sign(expire: number, email: string, salt: string) {
            let hash = crypto.createHash('sha256');
            hash.update(String(expire));
            hash.update(email);
            hash.update(salt);
            return hash.digest('hex');
        }

        let result = [String(expireMili), email, sign(expireMili, email, password + appname)].join('|');
        return new Buffer(result).toString('base64');
    },

    // the whole generate & valid logic token can be replace with JWT. it would be much easier to do so 
    async validateResetToken(
        token: string,
        findUserByEmail: (email) => Promise<User>): Promise<Either<Error, User>> {

        let result = new Buffer(token, 'base64').toString();
        let tokens = result.split('|');
        if (tokens.length !== 3) return new Left<Error, User>(new Error('invalid token'));
        let expire = parseInt(tokens[0], 10);
        if (Date.now() > expire) return new Left<Error, User>(new Error('token expired'));

        let email = tokens[1];
        if (!validator.isEmail(email)) return new Left<Error, User>(new Error('invalid email: empty'));

        let dbuser = await findUserByEmail(email);
        if (!dbuser) return new Left<Error, User>(new Error('invalid email: no user'));

        let createdToken = resetToken.generateResetToken(expire, email, dbuser.password);
        // this implementation is more slower than the simple string comparison
        // let diff = token.length === createdToken.length ? 0 : 1;
        // for (let i = createdToken.length - 1; i >= 0; i--) {
        //     diff |= token.charCodeAt(i) ^ createdToken.charCodeAt(i)
        // }
        if (createdToken !== token) return new Left<Error, User>(new Error('invalid token'));
        else return new Right<Error, User>(dbuser);
    }
}