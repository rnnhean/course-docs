[00:00] hi and welcome on this lecture we'll start working on real-time store all right what we're gonna do is right typing the logic for connection to the real time and wait or lessening for incoming messages okay let's just start by create real-time chat
[00:29] chat.js file all right how we need here to first we need to start so you connect hangar with the name we just call it real time chat which we call whatever it is below the song export default real time
[00:58] chat right after that we just say state we need to start to define some states just like dws now private messages or messages anything both are work online
[01:27] friends user ID number of unreaded messages a number of messages
[01:54] real or real time just keep it zero call after that let's just define the gathers get user id state goes to return
[02:24] state user ID Next get private messages State goes to
[02:53] return state private messages okay next get get a real time number messages state goes to
[03:23] a return state number of unreaded messages real or real time, anything. After that I just define as a run, forget online friends.
[03:51] state return state online friends next demutations
[04:20] First, we just have a mutation for set WS or WebSocket set WS state WS state WS goes to WS Update number of
[04:48] messages state this will be state.number of already the message real goes to state.number of already the message real plus one next we need to add private messages
[05:17] or private message state message state or private message equal to message okay next we can have another one
[05:45] to clear the private message clear i'm not sure if organized or not just say while we are developing this private message state state private messages goes to empty array
[06:13] after that set user id which will take state f json dot parts local storage getItem profile
[06:42] State user ID goes to json.parse local storage.getItem profile result.result
[07:11] if it exists under score id i just add custom mark here as well as result under score id okay it look good here is the mutation so i just add your comma and now i just
[07:41] start at the action okay I just start while create the first one which is the for creating the connection async create chat connection which will take contacts
[08:11] and let's just try catch block first say contacts commit set user ID which is this one next check F
[08:40] DECONTACT.SPADE.USERID say CONNEST URI what goes to process.MV.VIEW we need to add this actually I didn't add it yet
[09:10] duplicate this one here change this real-time notification to real-time chat but this will work on 8000 and on just make sure that this is the correct port real-time chat mean yeah in 2009
[09:38] right now we need to copy this one going back here and paste that here all right next we need to come up here say const ws will equal to just make this a little bit bigger okay this will equal to new web socket
[10:07] and here we need to use backtext dollar sign value places URI okay is this totally exactly right we need yeah this look good okay let's just go back say URI dollar sign contacts
[10:35] state user of id okay next we need to come up here and say that this on open equal to and here we need to say contacts commit
[11:05] set underscore WS as this WS all right next WS on message goes to event const message goes to JSON parse
[11:35] event.data all right this is the first thing but we need to dispatch different actions on different messages for example we should get two messages on for all friends and the other should be actually the real messages
[12:04] we can just come up here say with not message dot online friends on that case we can just say contacts commit update number of related messages and just copy it's on
[12:34] paste that here next contacts no contacts commit and we can just update this one by say a private message copy this one paste it here
[13:02] of this will take payload which is the message okay now on else this is mean that this is on online friends so I can just say honest unique users all those two array from new set
[13:31] message online friends contacts.commit set online friends okay I don't have this one for set online friends
[13:57] I just came up here and start at this one you can just click in below this one for example and say set online friends or users which will take state and online friends had a comma here and say state online
[14:26] friends equal to this online friends symbols dot now we can use this mutations okay for that we can simply pass the unique users okay next we can just hit save about catching dirt we can just say console
[14:55] dot log e and pass this error and after all we can hit save and go inside this one index and add this one we just duplicate this real time chat came up after this one pass it here real time chat
[15:25] we're all I think that's all I need to do on this lecture we can start to use this on this towards this real time on the next lecture
[15:34] you
