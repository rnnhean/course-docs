[00:00] Hello and welcome. As we said in the last lecture we'll start working on CrePost but as you can see here you can see several problems or errors appears and that's obviously because that we already have been updated the B-model especially this field that the new field will convert the user
[00:29] or the creator from to being just string to an object ID alright we'll just start work on it one by one ok I just came up down here and here we can convert this string to the object ID so we can just add a comment
[00:57] to object.id.ac. I just say user.id.sd.org user.id.sd.org all equal to clocals user.id.dot
[01:27] string okay next I can just say user obj id error this one goes to primitive object id from x so past this user id is the R right that one next you can check if error not equal to null
[01:54] on that keys we can return anything i believe we can copy this directly paste it here except that we will just remove this one and here's one user we can just say invalid user ID okay that's cool after that i think we can verify
[02:23] if the user exists or not first. I don't know, I've already done this before or not, but let's just do it anyway. I'll just say more users, sorry, more users from models.
[02:52] user model next check the errors where this user schema fine one ctxpeson.m underscore id user id of the user
[03:21] ok next we can decode this what the user variable that we are ready to hide user already decode this why this give us an error and this block
[03:48] where exactly okay we already done this here mm-hmm I just copy this and then I just take this out go up up up and where are we we're here check F
[04:17] error not equal to 0 ok so we want to re-turn this alright and then we need to go down here the first one is choose the creator this one needs to be updated just use our object ID
[04:46] and related to the comments i don't think that we need to create anything here yep i think so i'm just also sorry take all this out what i needed
[05:15] and i think that this won't work by this way i think we need to create a pipeline and use aggregate in order to make this to work but anyway let's just test it and see what we will have but first we don't need to fix the errors here
[05:41] We need just, I think, audio, if I just check this out in the resolution, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know, I don't know,
[06:07] When you are in argon and to pent cannot just be not linear. This actually need to totally, totally update it. So what we can do here is to take all of it out for now and just return no.
[06:35] okay next we're here unlike post on notification I think we can just convert this to hex you just came up here go down and say hex save
[07:03] next time finally this one we try to compare to sorry hex all right all the arrows has been gone right now okay
[07:31] I think we need first to update this log. Alright. Next we need to initialize this.
[08:00] ok the error has disappeared now we just run the app
[08:29] All right. Okay, we need to open localhost, 5000 followers. Okay, this one's here. All right.
[08:52] Now we need to start by logging and grab the authentication, the access token and just sign in. Okay, alpharata will just copy the token. Authorize just... I think we need to write down power source.
[09:21] And token of rise close Okay, what is the first career post? You'll say anything I had I need to head on throughout the right
[09:48] Unselect the time base 64 anything title anything like that now they just hit on execute okay this has been created look I got this created
[10:18] or yeah, this created. Just check that out. I need to refresh this one. Okay, messages posts. Okay, we have hello address post.
[10:47] name any likes and create that okay that's cool this works great but I think that we need to fetch the create a post with the user data okay so let's
[11:16] go back here where we don't we don't need to change this a little bit we just take the cells down alright how can i do this okay after insert
[11:45] to the post, we need to check over this. I just take this out for now, ok. I know that we can just game up here. You can add any comment, just like fetch. Decorated post, wait.
[12:15] user data, down here I just start with a word, sorry created, post models, post model, and then we need to create a simple pipeline.
[12:40] much only equal to array of pason pason m array over slice, maybe that's the worst but it called slice here all right the first thing that we need to say that we're
[13:09] this is actually match can use match operators as you already know where the ID is equal to result.insertedID okay what else
[13:36] after that we can also use another very useful operator just like lookup
[14:05] sorry sorry sorry users collection local field creator
[14:27] and the forum field of course all going to be IE all this we want it to be as just user I know that this look like
[14:56] now we have kind of a SQL language, but this is outsourced with MongoDB alright, that's great, after that we just came down here and we need to add another operator unknown and this variable of user
[15:23] next we can create a project or use project operator to organize all this sorry sorry sorry yeah project and here we need to have another piece on and now we can start to organize this say ID
[15:51] on creator also this is okay on here represent if we need it or not all right let me just double look at this multiple times our taster title message
[16:21] after that the user not name as well as the user
[16:50] image sorry sorry sorry it's small case you are all right by this way here whenever we do need I am we don't need to create
[17:14] so whenever we create post this will give us the real-time updated user data okay I think that's much better and you need to work by the same way by the exact same way because on our old if you remember
[17:44] code on our older version of our code was actually just putting the creator the username and user data and if that user updates that data this doesn't affect on our created posts it still has the old data.
[18:13] Ok, cool. Now, what we can do actually is, for example, we just stop by a clear cursor. Error. Save this one icon to post schema. Aggregate CTX or contacts. And just pass this pipeline. Then we can check
[18:43] FDR decondition is error not equal to null on that case we can return any symbol or run message just to grab it from any place just like this one is here I start here
[19:10] and what we can see here about the error field of edge created both assembles that next we need to defer for this cursor how we created just close it after this CTX
[19:39] okay next we can check if, sorry, fcorresor as next and this also take the conducts if that the case we won't say f error equal to corridor now we need to decode this created post
[20:08] sorry no i didn't use dollar sign okay created post if that error not equal to new so i can return something like that i just copy and paste it here
[20:34] change this to be to failure to decode it or decode post right after all we can simply only turn c.status fiber created status created yep
[21:02] just on all this created post all right i think that's very cool now adjust to head save and we need to use airshort just to rerun our app one more time okay we just set right now just go back we can use the same just change this to second
[21:32] okay second now just hit on execute one more time okay this gift to us I don't think this gift was how we expected the name is empty
[22:00] okay I'm not sure what is yours I think I can just clear the cache from the page start as this one more time
[22:29] optimize close here from tryout let's just check you have one interface first okay we have the correct object ID of the user name what kind of this was the old thing
[22:55] I'm not sure if we should yeah, and I'm not sure that we should have the same thing Yeah, all I think is that we need to remove this post Because this was the old way, posts Remove all of it, going back Okay, and here's one of us
[23:24] I should keep creator title message but not name because this name represents actually the user so we need to do this at all and just save of course we need to refresh this all right
[23:54] Okay, let's just try to run this one more time. Let's see how it happens. It locks, it's now going back. Hello. Pays 64 in E.
[24:21] ok, just hit on execute cf ok, we just return to us this one is yours write it all, select the file, excrete that
[24:51] okay okay it looks like that we need to fix something maybe we need to fix this one
[25:21] okay we just remove it and use different approach say user will be pistol.m all right we can just say name will be m no sign user root name and image
[25:49] we are equal to user or variable user image URL ok i just use this approach and see what happens ok i just run this one more time hit on execute
[26:18] okay look like still goes the same thing okay we just go back and check our trap one more time all right maybe in this talking globe because this is on our face
[26:47] not necessarily an objectoidy okay also i think there might be because of this one here i do ignore this to just give it the same values um empty
[27:16] okay i just rerun this already cleared up cleared out all the old data okay now let's just go back and hit on execute all right that's great it looks like that everything works fine
[27:45] it does not return the email or the password it doesn't return anything actually except the name and the image URL it doesn't return the ID or anything like that alright how if we use the old approach sorry just remove all this
[28:14] okay okay just re-opening this post control okay now let me just take this out and try to use the old approach to see how I will have
[28:43] just now take the sword, run this one more time ok, hit on a low axis and call this second hit on execute ok this gives nearly the same sync
[29:11] it does only your return the user's name and user's image overall overall I think we're good till now we've already fixed a real issue related to the updated user data that we can have with inside or yeah inside each post
[29:39] on our older version whenever we update the username this will not be updated by default even if we update the image the user image URL we will have this old image URL for our user besides the post data which of course not called ni or call command
[30:08] we can carry on updating the post, the controller on the next lecture just like getting post, all the comments related to it as well as also we need to update user controller for getting user profile data we want to imagine it, we want also to work on it a little bit
[30:37] so just carry on on the next lecture
