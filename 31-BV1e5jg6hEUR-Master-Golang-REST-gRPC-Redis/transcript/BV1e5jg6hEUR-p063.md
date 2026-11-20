[00:00] hello and welcome on this lecture tool store to add the new route and add the handler for it and I don't think that we need to have a special route for this we can just add it here with our post routes so I just go up here delete comment
[00:28] Up, delete, slash comments. Next, we need to pass the post ID, slash comments.
[00:57] Slash the comment ID And of course we need the medallors Oath Medallors Controllers
[01:22] delete comment ok save temporary and just move down here and just start to work on that
[01:52] to copy all this paste dot here this one will be delete comment ok, summary delete a comment in this on the description delete a comment
[02:21] by comment ID of the next d tag is we want two perums actually first one will be ready to find this here post ID i just copy it and paste that here this is the post ID
[02:49] just duplicate this 1x21dcd string on pass through this one is dcd
[03:15] Okay, now we have Fenerbahce. And this per rod. Okay, now I want the pass. The rod will be this one's here. I just copy it and paste it here.
[03:43] Okay, comments plus ID. This should be boy this way, actually. Next comments, comment ID. Yeah, that's great. Now I just define the function, delete, comment.
[04:11] see as you can see the error has been gone fiber contacts return error all right go now we need to comment and let's just check out in this comment let's just copy all this
[04:41] go down, down, down, down, down, best all here i need is the post and the comment i didn't need the user or the notification okay next we want to get the comment ID from perums
[05:08] so primitive object ID from hex c.perms comment ID in this one here and just copy it directly and paste it here, alright
[05:33] we want to check f not equal to 0 on that keys why this yeah we want to check f in the errors now equal to 0 on that keys we can return anything yeah something like that just this not huge okay
[06:03] this can be valid request okay and we can just say invalid command tidy that's cool we can do the same with the post ID just need to change this
[06:31] just copy this from here directly paste that here and when it post id all right next we need to get the current or the logged in users id
[06:59] current user id equal to we can directly get the current user opg id okay this one goes to primitive
[07:28] object ID from hex and here we can say c.locals user id as a string ok next we want to find the command and check
[07:56] the ownership in one query so what we can do is to say for comment models comment and just say error will goes to comment schema
[08:26] find one ctxiso.m underscore id comment id and the post post id is this post id
[08:56] all right and I can simply decode this comment. next we can just check if error not equal to 0. I can return let's just copy this, paste that here
[09:23] not found we can just say comment not found after that we want to get the post to check if users is the post owner or not
[09:52] So what I can do is to climb up here and save our post models
[10:14] post model I just copy all this and simply paste that here
[10:38] yeah okay we need to change this a little bit starting by say post schema find on ctx just the id where this is equal to post id
[11:04] and now we want to decode is the post okay we need now to change this to be post not hunt now we want to check if the user authorized or not
[11:27] we can just check if comment look user sorry user id not equal to current user id object or post creator
[11:56] not equal to current user object ID so the boss creator shows the user who add this comment both of them has the right to remove the comment it's a simple idea for building JSONfiber.map
[12:25] Error, how can I say here, you are not authorized to delete this comment. Alright, that's cool.
[12:50] now we can delete the comment use assemble delete way we can just sort by say result we just come up here say delete result sorry a result
[13:15] and error variables both of them will go to command schema delete on ctxandperson.m where id is the command tidy symbol of that
[13:41] then check if error is not equal to nil on that case we can return something like that copy and paste this should be internal server error failed we can just say failed
[14:10] to the lead comment after that we can just check f result the lead count is equal equal zero
[14:37] I can return something like that I can just say comment not found or already deleted cause maybe
[15:05] our users and the owners of the post and the commenters, both of them try to delete the same comment at the same time, anyway now we can just return c.status fiber shock
[15:33] just a comment deleted successfully
[16:00] deleted command hoid can be command hoid x yeah I think everything is cool
[16:29] now we can just throw it to this dot we need to rerun our app, just throw it to this ok hit allow absis going back i think we need to refresh this one yep we have new neo comments let's just throw it to remove this one
[16:59] but I think also we need to clear this clear this here so we won't have this new swag in the connotation alright
[17:26] Now let's just go back what we need. Remember, remember, remember. We need this pair for this authentication key. So please copy this first to refresh. Add this for authorization. So it's closed.
[17:54] We have this, delete comments, okay. Now, let us set on throughout. We will try to open this, the post id. Copy the post id first. Go back, put that here. Make sure that we copy it correctly, yeah, the comment id.
[18:21] all right since the timer on the user list I think this will be successfully deleted yep if we go in back now try to refresh will have just on documentation yep all right great I think that's all we need to do on this lecture now we can move on to the next
