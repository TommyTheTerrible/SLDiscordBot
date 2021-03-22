"use strict";
// SL to Discord bot
// This module watches group chat messages and sends them to Webhooks, such as those used by Discord text channels.
// TommyTheTerrible 
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const node_metaverse_1 = require("@caspertech/node-metaverse");
const node_metaverse_2 = require("@caspertech/node-metaverse");
const node_metaverse_3 = require("@caspertech/node-metaverse");
const node_metaverse_4 = require("@caspertech/node-metaverse");
const node_metaverse_5 = require("@caspertech/node-metaverse");
//import { UUID } from '@caspertech/node-metaverse';
const node_fetch_1 = require("node-fetch");
class SLDiscordBot {
    constructor() {
        this.masterAvatar = 'd1cd5b71-6209-4595-9bf0-771bf689ce00';
        this.isConnected = false;
        this.isConnecting = false;
        this.webhooksFilename = path.resolve(__dirname, "../config/webhooks.json");
        this.webhooks = require(this.webhooksFilename);
        const loginParameters = new node_metaverse_2.LoginParameters();
        const parameters = require(path.join(__dirname, '..', '/config/loginParameters.json'));
        this.__LoadWebhooks();
        // Watch Webhooks json for changes
        fs.watchFile(this.webhooksFilename, (curr, prev) => {
            console.log(`Webhooks.json updated at ${curr.mtime}. Last update was at ${prev.mtime}.`);
            this.__LoadWebhooks();
        });
        loginParameters.firstName = parameters.firstName;
        loginParameters.lastName = parameters.lastName;
        loginParameters.password = parameters.password;
        loginParameters.start = parameters.start;
        // If you don't intend to use the object store (i.e you have no interest in inworld objects, textures, etc,
        // using nmv.BotOptionFlags.LiteObjectStore will drastically reduce the footprint and CPU usage.
        //
        // The full object store has a full searchable rtree index, the lite does not.
        //
        // For the minimum footprint, use :
        //
        const options = node_metaverse_3.BotOptionFlags.LiteObjectStore | node_metaverse_3.BotOptionFlags.StoreMyAttachmentsOnly;
        //const options = BotOptionFlags.None;
        this.bot = new node_metaverse_1.Bot(loginParameters, options);
        // This will tell the bot to keep trying to teleport back to the 'stay' location.
        // You can specify a region and position, such as:
        // bot.stayPut(true, 'Izanagi', new nmv.Vector3([128, 128, 21]));
        // Note that the 'stay' location will be updated if you request or accept a lure (a teleport).
        // If no region is specified, it will be set to the region you log in to.
        this.bot.stayPut(true);
    }
    __LoadWebhooks() {
        return __awaiter(this, void 0, void 0, function* () {
            this.webhooks = JSON.parse(fs.readFileSync(this.webhooksFilename, "utf8"));
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const exitHandler = (options, err) => __awaiter(this, void 0, void 0, function* () {
                if (err && err instanceof Error) {
                    console.log(err.stack);
                }
                if (this.isConnected) {
                    console.log('Disconnecting');
                    try {
                        yield this.bot.close();
                    }
                    catch (error) {
                        console.error('Error when closing client:');
                        console.error(error);
                    }
                    process.exit();
                    return;
                }
                if (options.exit) {
                    process.exit();
                }
            });
            // Do something when app is closing
            process.on('exit', exitHandler.bind(this, {}));
            // Catches ctrl+c event
            process.on('SIGINT', exitHandler.bind(this, { exit: true }));
            // Catches service restart event
            process.on('SIGTERM', exitHandler.bind(this, { exit: true }));
            // Catches "kill pid"
            process.on('SIGUSR1', exitHandler.bind(this, { exit: true }));
            process.on('SIGUSR2', exitHandler.bind(this, { exit: true }));
            // Catches uncaught exceptions
            process.on('uncaughtException', exitHandler.bind(this, { exit: true }));
            yield this.login();
        });
    }
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isConnecting) {
                return;
            }
            this.isConnecting = true;
            try {
                if (this.reconnectTimer !== undefined) {
                    clearInterval(this.reconnectTimer);
                }
                this.reconnectTimer = setInterval(this.reconnectCheck.bind(this), 60000);
                console.log('Logging in..');
                this.loginResponse = yield this.bot.login();
                console.log('Login complete');
                // Establish circuit with region
                yield this.bot.connectToSim();
                console.log('Waiting for event queue');
                yield this.bot.waitForEventQueue();
                this.isConnected = true;
            }
            finally {
                this.isConnecting = false;
            }
            return this.connected();
        });
    }
    reconnectCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                yield this.login();
            }
        });
    }
    connected() {
        return __awaiter(this, void 0, void 0, function* () {
            this.bot.clientEvents.onDisconnected.subscribe((event) => {
                if (event.requested) {
                    if (this.reconnectTimer !== undefined) {
                        clearInterval(this.reconnectTimer);
                    }
                }
                this.isConnected = false;
                console.log('Disconnected from simulator: ' + event.message);
            });
            yield this.onConnected();
        });
    }
    // @ts-ignore
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.reconnectTimer !== undefined) {
                clearInterval(this.reconnectTimer);
                this.reconnectTimer = undefined;
            }
            return this.bot.close();
        });
    }
    onConnected() {
        return __awaiter(this, void 0, void 0, function* () {
            this.bot.clientEvents.onInstantMessage.subscribe(this.onInstantMessage.bind(this));
            this.bot.clientEvents.onGroupChat.subscribe(this.onGroupChat.bind(this));
            this.bot.clientEvents.onGroupNotice.subscribe(this.onGroupNotice.bind(this));
        });
    }
    onGroupChat(event) {
        return __awaiter(this, void 0, void 0, function* () {
            var account_first_name = event.fromName.split(" ")[0];
            var account_last_name = event.fromName.split(" ")[1];
            var account_photo;
            if (account_last_name == "Resident") {
                account_photo = "https://my-secondlife-agni.akamaized.net/users/" + account_first_name.toLowerCase() + "/sl_image.png";
            }
            else {
                account_photo = "https://my-secondlife-agni.akamaized.net/users/" + account_first_name.toLowerCase() + "." + account_last_name.toLowerCase() + "/thumb_sl_image.png";
            }
            var webhook = this.webhooks[event.groupID.toString()];
            var chatmessage = event.message.replace('@everyone', '').replace('@here', '');
            yield this.SendMessageWebhook(event.fromName, account_photo, chatmessage, webhook);
            //console.log('Group chat: ' + event.fromName + ': ' + event.message + ' sent to ' + webhook + ' ' + account_photo);
        });
    }
    onGroupNotice(event) {
        return __awaiter(this, void 0, void 0, function* () {
            var account_first_name = event.fromName.split(" ")[0];
            var account_last_name = event.fromName.split(" ")[1];
            var account_photo;
            if (account_last_name == "Resident") {
                account_photo = "https://my-secondlife-agni.akamaized.net/users/" + account_first_name.toLowerCase() + "/sl_image.png";
            }
            else {
                account_photo = "https://my-secondlife-agni.akamaized.net/users/" + account_first_name.toLowerCase() + "." + account_last_name.toLowerCase() + "/thumb_sl_image.png";
            }
            var webhook = this.webhooks[event.groupID.toString()];
            var noticeMessage = event.message.replace('@everyone', '').replace('@here', '');
            var noticeSubject = event.subject;
            yield this.SendNoticeWebhook(event.fromName, account_photo, noticeSubject, noticeMessage, webhook);
            //console.log('Group chat: ' + event.fromName + ': ' + event.message + ' sent to ' + webhook + ' ' + account_photo);
        });
    }
    onInstantMessage(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (event.source === node_metaverse_4.ChatSourceType.Agent) {
                if (!(event.flags & node_metaverse_5.InstantMessageEventFlags.startTyping || event.flags & node_metaverse_5.InstantMessageEventFlags.finishTyping)) {
                    // typeInstantMessage will emulate a human-ish typing speed
                    yield this.bot.clientCommands.comms.typeInstantMessage(event.from, 'Thanks for the message! This account is a scripted agent (bot), so cannot reply to your query. Sorry!');
                    // sendInstantMessage will send it instantly
                    yield this.bot.clientCommands.comms.sendInstantMessage(event.from, 'Of course I still love you!');
                }
            }
        });
    }
    SendMessageWebhook(userName, userImage, userMessage, webhookURL) {
        return __awaiter(this, void 0, void 0, function* () {
            let fetchBody = JSON.stringify({
                username: userName,
                avatar_url: userImage,
                content: userMessage
            });
            node_fetch_1.default(webhookURL, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: fetchBody
            });
        });
    }
    SendNoticeWebhook(userName, userImage, noticeSubject, noticeMessage, webhookURL) {
        return __awaiter(this, void 0, void 0, function* () {
            let fetchBody = JSON.stringify({
                username: userName,
                avatar_url: userImage,
                embeds: [{
                        color: 1127128,
                        title: noticeSubject,
                        description: noticeMessage
                    }]
            });
            node_fetch_1.default(webhookURL, {
                method: 'post',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: fetchBody
            });
        });
    }
}
new SLDiscordBot().run().then(() => { }).catch((err) => { console.error(err); });
//# sourceMappingURL=index.js.map