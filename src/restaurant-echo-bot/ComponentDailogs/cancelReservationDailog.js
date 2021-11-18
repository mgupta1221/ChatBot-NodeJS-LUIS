const { ComponentDialog, WaterfallDialog, DialogSet, DialogTurnStatus } = require("botbuilder-dialogs");

//Each prompt is an implementation of Dailog Class type  
const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt } = require('botbuilder-dialogs');

const { CardFactory } = require('botbuilder');
const restaurantCardJSON = require('../resources/adaptiveCards/Restaurantcard')

const CARDS = [restaurantCardJSON];

// Each prompt is added to Dialogset with a specfic String Id hence we are creating the below string Ids
// So when your bot wants to start a dialog or a prompt within the dialog set it uses that String Id
const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
//created local variable to notify dialog end to main Bot i.e. myRestaurant
var endDialog = '';

class CancelReservationDailog extends ComponentDialog {

    constructor(conservsationState, userState) {
        super('cancelReservationDialog');


        //Adding all prompts via StringIds 
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));// With Validator
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

        //Adding WaterFall Dialog which is set of steps in sequence
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this),  // Ask confirmation if user wants to make reservation?            
            this.confirmStep.bind(this), // Show summary of values entered by user and ask confirmation to make reservation
            this.summaryStep.bind(this)

        ]));




        this.initialDialogId = WATERFALL_DIALOG;


    }

    // accessor is a state property accessor, or, Dailog State property
    // main thing about this code is we are passing 'turnContext' to every new dialog aor dialogSet we are creating
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this); // adding all dialogs we created above in the constructor

        const dialogContext = await dialogSet.createContext(turnContext);//this tunContext is visible by ActivityHandler in our main dialog
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {//checking if the dialog is already active when the user first land on this particular component dialog
            await dialogContext.beginDialog(this.id); //if dialog is not already active, it wil start from the begnining
        }
    }


    async firstStep(step) {
        endDialog = false;
        await step.context.sendActivity({
            text: 'Enter reservation details for cancellation:',
            attachments: [CardFactory.adaptiveCard(CARDS[0])]
        })
        return await step.prompt(TEXT_PROMPT, '');

    }

    async confirmStep(step) {

        step.values.reservationNo = step.result

        var msg = ` You have entered following values: \n ReservationNo: ${step.values.reservationNo}`;

        //sending the msg back to user first 
        await step.context.sendActivity(msg);

        return await step.prompt(CONFIRM_PROMPT, 'Are you sure that all values are correct and you want to CANCEL the reservation?', ['yes', 'no']);
    }

    async summaryStep(step) {

        if (step.result === true) {

            await step.context.sendActivity("Reservation successfully cancelled. Your cancellation id is : 12345678")
            endDialog = true;
            return await step.endDialog();

        }
    }


    async noOfParticipantsValidator(promptContext) {
        // This condition is our validation rule. You can also change the value at this point.
        return promptContext.recognized.succeeded && promptContext.recognized.value > 1 && promptContext.recognized.value < 150;
    }

    //method created to return the state of dialog if it is ended.
    async isDialogComplete() {
        return endDialog;
    }
}

module.exports.CancelReservationDailog = CancelReservationDailog;
