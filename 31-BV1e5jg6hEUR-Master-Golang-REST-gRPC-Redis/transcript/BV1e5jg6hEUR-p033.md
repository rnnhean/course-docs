[00:00] hello and welcome on this lecture we will start creating the poles of the endpoints for the notification right let's just not waste any time and start work on that can go to the VS code and then we can just go here on just close this go to the routes create
[00:28] notification routes or not routes and we can simply copy this one for example and just paste that here and change this to notification. now we need to go back to the main.go and start set the route
[00:56] change this to setup notification routes we can save and now go back here actually both of them will be get just call this change it to get and we need to change this to notification
[01:22] all right the first one will be mark modification as read or as read second will be just we can pass column user ID
[01:50] to get notification ID for the validation we didn't need this validation on controller on controller we need to have to endpoint one mark not as rated
[02:17] and the second one we can just call it and for example get user notification all right let's just for now save this and now we need to create the notification controller just came here store create
[02:46] all right i think we need to simply copy this one for example just copy all this going back and we can paste that here all right we just receive
[03:15] and start by the first endpoint it should call we need to change this create to mark not as redid here on summary mark notification
[03:41] As I read it, all right. For a user, all right. Description is nearly the same. I didn't need this description. You can just ignore it or leave it as it is. Change this tags to notification.
[04:10] or notifications here we do have the id as query so here on perm we need to say perm id query string true
[04:37] user already, alright and we can just copy this one and paste it here changes to just 200 or did it need security perros now here we need to say slash notification
[05:07] slash mark, hmm, I believe we can directly copy this and simply paste it here and now we need to change this to mark, this is not post of course, this is actually git
[05:34] finally we can change this to mark not as read this should make this disappear just copy it from here paste it here save go back now they are all disappear alright and let's just talk on that one by one we can just
[06:02] stored by parse the corporem and just say id c.query id checkf the id
[06:31] is equal to equal empty string on the case we can return any kind of error we can just copy this one and just paste that here can just say error id per is required
[06:59] anything like that after that we need to construct the filter on the update
[07:28] just make a space here all right go up here add a command construct default and adopt it first the default can be PSOM dot M main UID
[07:57] pason.m reg ex id options and just pass i
[08:25] to make this just not case sensitive, alright update can just say personal, m can use operator as always set personal.m
[08:52] can just say is reddit if i remember we named it like that on the model is reddit so we need to call it by the same name we need to change this to true that's it now the update can just say underscore and error
[09:21] we need to cut this and paste that here change this to notification notification schema
[09:51] and we need to come here and say notifications all right after that we need to say notification schema dot update we didn't need to update on we need to update mini so we need to pass the contacts ctx but before this we need to define the contacts so we can just also cut this and paste it here after we're passing the contacts
[10:21] we should pass the filter finally the update, very well after that we need to check if error not equal null no equal null on that case we need to return this
[10:48] here and turn on server error message or error we can just say field to mark notification as read we can make this message
[11:14] and also pass the error as well error.error that's pretty it we can also retrieve the updated notifications we can just come here and say
[11:41] or notifications we need to have an option here first options this will equal to options not find setSortPessel.m
[12:11] The key will be created out. I'm not sure that this is correct. Yeah, we need to put this between double curly places. The key... This should be a piece on D actually. Yeah.
[12:39] created that right and value value just minus 1 to get this descending after that we can just say Corrosor error notification schema
[13:08] find as the contacts as the filters we need to have the same filter back to this options all right i just copy this and directly paste it here fail to the
[13:36] code failed to retrieve the updated notification all right after all we can just remove the rest all right cool now here we need to say just defer this cursor
[14:05] close buzz the ctx the contacts after that war notifications array of modules notification after that we can just say f error
[14:33] of this corusor not I can just say all ctx Can we say notifications? if error not equal null we can return something like that paste that here this is how we can do it directly use the loop
[15:02] we can just say fail to to the good notifications all right we're cool after all we can just say return c.status fiber.oc
[15:30] status oak which is 200 json fiber all right fiber dot map and we can just say notifications not if not if we gauge on
[16:00] and just pass this notifications, alright just hit save and then we need to copy this one and just place that here this is the first one, the second one we do call it get user notification
[16:29] all right the rule will disappear all right we just solve by change this all right here we need just to say get user notification all right
[16:57] here per user id and pass string to every single, nearly the same just to come here and change this port or dynamic port just pass user id
[17:26] right cool we need to change this port to path no no path sorry this perums yeah and this is actually user ID
[17:53] Alright, for after that we need to have deconstruct salters and we need to have these options
[18:23] and I believe that we can just use this one just cut this one paste that here I'm sure we don't need the spot to be at the top
[18:50] so we start by extracting the user id then call the notification schema then having the filter and the options to get it descending and say get find yeah and we can just remove this one whether it needed whether it need to have the update
[19:18] and every second goes nearly the same but we need to just came here check f the length of the notifications is equal equal 0 on that case on that case we can just say
[19:47] copy all this just paste it here change this to models.notification and pass calipers that's pretty it now we need to hit save but to be able to test this we need to say
[20:17] make swag in it go back here we need to call this one more time alright now we just store by refresh okay we should have this one notification here just store by get the notifications
[20:45] for isle the creator refer to the isle id can just copy this let's start here hit on execute actually this return an empty notification so something is not right need to go back now i think there is no error here if you go back here you'll see that we get this id for isle
[21:13] actually we are looking for this one for where menu ID is this one which is Ahmed ID so we just copy it or you can just go to the user and copy the Ahmed ID and now we need to go back paste and try to execute this as a matter of fact this also give us
[21:40] Do we copy this correctly? Okay, if we go to renovation, main user ID. So why is this not working? This is weird. Yeah, it look like. That this port is not dynamic. Yeah, if we go back here, not throughout.
[22:07] if you go back here on the coral you'll see that this port is actually not dynamic port so we need to go back and see why is that happening yeah that's because we should change this on get notification to user ID
[22:36] note id if we hit save copy this one and take horror about run take this out yeah and run mix again it refresh call this here with until application is rerunning
[23:05] I don't try out paste that here. What is that? Okay, go back copy the menu ID Paste that here I don't execute as you can see this gets all Ahmed ID notifications From the first to the last this exactly I need
[23:34] all right cool note that all of them is false all right if you go back here you'll see I think we forgot something here no we didn't forgot anything we want to return all of them even if it's true if easily it is true
[24:03] but the idea here that when we try now to head to a mark this has deleted I want to change this to true and on the front end part we can differentiate between them using this pulley end now head on execute as you can see it look like that everything works fine all of them has been changed to true we need to make sure that this works fine we can use this endpoint for that
[24:33] execute as you can see change to true refresh this as you can see all of them has been changed to true very well our endpoints work perfectly I think that's all what we need to do on this lecture even on this section maybe we need to have another assemble lecture on next lectures to have kind of version controlling and update the GitHub etc.
[25:02] So, see you on the next lecture.
