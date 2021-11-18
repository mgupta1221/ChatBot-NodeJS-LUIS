// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
    ActivityHandler,
    MessageFactory,
    BotState,
    UserState,
    ConversationState
} = require('botbuilder');

const { LuisRecognizer, QnAMaker } = require('botbuilder-ai');

const { MakeReservationDialog } = require('./ComponentDailogs/makeReservationDailog');
const { CancelReservationDailog } = require('./ComponentDailogs/cancelReservationDailog');

class RestaurantBot extends ActivityHandler {
    constructor(conversationState,
        userState) {
        super();

        this.conversationState = conversationState;
        this.userState = userState;

        // Below we created an accessor 
        // Each State Property accessor allows you to set or get the value of associated state property
        // We are only going to use ConvserationState in the solution, so below we only created accessor for the same
        // Notice the same is passed in the .run() method below when we initiate our Waterfall Dialog

        this.dialogState = conversationState.createProperty("dialogState");


        //creating global object for MakeResrvationDialog to access it to run() later
        this.makeReservationDialog = new MakeReservationDialog(this.conversationState, this.userState);

        this.cancelReservationDialog = new CancelReservationDailog(this.conversationState, this.userState);

        //previous Intent accessor is to maintain the current Intent ,or, the current Topic
        this.previousIntent = this.conversationState.createProperty("previousIntent");

        //conversationData accessor is to handle rest of everything, here in our example we use this to maintain if Dialog has ended
        this.conversationData = this.conversationState.createProperty("conversationData");



        // Luis Recognizer 
        // Map the contents to the required format for `LuisRecognizer`.
        const luisApplication = {
            applicationId: process.env.appId,
            endpointKey: process.env.subscriptionKey,
            endPoint: 'https://${process.env.azureRegion}.api.cognitive.microsoft.com'
        }
        // Create configuration for LuisRecognizer's runtime behavior
        const luisPredictionOptions = {
            includeAllIntents: true,
            log: true,
            staging: false
        }
        const luisRecognizer = new LuisRecognizer(luisApplication, luisPredictionOptions, true);



        // For QnAMaker
        const qnaMaker = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId,
            endpointKey: process.env.QnAEndpointKey,
            host: process.env.QnAEndpointHostName
        });

        this.qnaMaker = qnaMaker;


        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        // onMessage() is to handle all incoming messages, you can decide which Dialog should the messgae should be routed to, here
        this.onMessage(async (context, next) => {

            //local variable to save the LUIS result
            const luisResult = await luisRecognizer.recognize(context);
            console.log("LUIS: " + JSON.stringify(luisResult));
            const intent = LuisRecognizer.topIntent(luisResult); //topIntent() method returns the topIntent


            //fetching entities too, e.g noOfParticpants requested by user for reservation for reservations in his message
            const entities = luisResult.entities; //we have to pass it to the run() method to not show the number of partipants prompt if value is present

            //helper function created
            await this.dispatchToIntentAsync(context, intent, entities);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });


        //called everytme a new Dialog is initiated (called aftre onMessagehandler)
        this.onDialog(async (context, next) => {
            //After each step of the waterfall dialog, we need to save the conversationState
            //which in turn will save the Dialog state beacuse its a property accessor under ConservationState
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });


        // called when a user joins the conversation(opens the bot)
        this.onMembersAdded(async (context, next) => {

            await this.sendWelcomeMessage(context);
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;

        // Iterate over all new members added to the conversation.
        for (const idx in activity.membersAdded) {
            if (activity.membersAdded[idx].id !== activity.recipient.id) {
                const welcomeMessage = `Welcome to Restaurant Reservation Bot ${activity.membersAdded[idx].name}. `;
                await turnContext.sendActivity(welcomeMessage);
                await this.sendSuggestedActions(turnContext);
            }
        }
    }

    async sendSuggestedActions(turnContext) {
        var reply = MessageFactory.suggestedActions(['Make Reservation', 'Cancel Reservation', 'Restaurant Address'], 'What would you like to do today ?');
        await turnContext.sendActivity(reply);
    }

    async dispatchToIntentAsync(context, intent, entities) {


        let currentIntent = '';
        //getting the current values of accessors
        const previousIntent = await this.previousIntent.get(context, {});
        const conversationData = await this.conversationData.get(context, {});

        //checking if previously running topic/dialogue is still running and dialog has NOT ended
        if (previousIntent.intentName && conversationData.endDialog === false) {
            currentIntent = previousIntent.intentName;
        }
        else if (previousIntent.intentName && conversationData.endDialog === true) { //checking if previously running topic is still running and dialog has ended
            //setting the current topic to what we have just recieved

            //currentIntent = context.activity.text; //before LUIS
            currentIntent = intent; //after LUIS

        }
        // If the current intent is neither "MakeReservation/Cancel Reservation" than route to QnAMaker and there is no already running intent
        else if (intent == "None" && !previousIntent.intentName) {

            var result = await this.qnaMaker.getAnswers(context);
            await context.sendActivity(`${result[0].answer}`);
            await this.sendSuggestedActions(context);
        }
        else { // case when there is no running topic, like when we have just started so we set the acccessor here with default values
            //setting the current topic to what we have just recieved, this will set to 'Make Reservaton' becuase that is first msg

            //currentIntent = context.activity.text; //before LUIS
            currentIntent = intent; //after  LUIS

            await this.previousIntent.set(context, { intentName: intent });
        }

        switch (currentIntent) {
            case 'Make_Reservation':
                console.log("Inside Make Reservation Case");
                //before runing the dialog, setting value of endDialog as false
                // await this.conversationData.set(context, { endDialog: false });

                await this.makeReservationDialog.run(context, this.dialogState, entities);

                // getting the endDialog state from 'makeReservationDialog.js' and setting it to conversation state
                // Notice 'conversationData' below is a local property not accessor one so can be set directly
                conversationData.endDialog = await this.makeReservationDialog.isDialogComplete();

                //sending options again if dialog has ended
                if (conversationData.endDialog) {
                    //resetting the previousIntent here once current Dialog has ended which means e.g. MakeReservation has ended or Cancel Resevation has ended
                    await this.previousIntent.set(context, { intentName: null });
                    await this.sendSuggestedActions(context);
                }
                break;

            case 'Cancel_Reservation':
                console.log("Inside Cancel Reservation Case");
                await this.conversationData.set(context, { endDialog: false });
                await this.cancelReservationDialog.run(context, this.dialogState);
                conversationData.endDialog = await this.cancelReservationDialog.isDialogComplete();
                if (conversationData.endDialog) {
                    //resetting the previousIntent here once current Dialog has ended which means e.g. MakeReservation has ended or Cancel Resevation has ended
                    await this.previousIntent.set(context, { intentName: null });
                    await this.sendSuggestedActions(context);
                }

                break;


            default:
                console.log('Incoming messsage did not match the resrvation case');
                break;
        }




    }
}

module.exports.RestaurantBot = RestaurantBot;
