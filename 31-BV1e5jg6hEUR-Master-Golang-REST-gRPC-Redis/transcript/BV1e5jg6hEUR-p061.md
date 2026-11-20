[00:00] hello and welcome on this lecture as we said on the last lecture we will start working on this add comments or comment on post new functionality not just that what we want to do is actually is to return the new post or the updated post after adding this new comment with all the comments related to this post
[00:29] okay so for now just take this in again all right let's just start work on it one by one okay first of all we need to add a new collection or a new schema we name it schema so let's just give it what the same name so have variable we can call a command
[00:56] schema which will equal database db collection comments all right then what we have here is to have this comment post okay
[01:26] next we have this post ID okay after that we are ensuring that the post is exist or not all right okay from this point just remove the old
[01:52] so this point here okay and we want first to grab the current user id so we just say or the the commenter id user opg id
[02:19] underscore this will go to primitive object ID from hex and in here we can just say seed of locals and we can define this user
[02:48] ID and see that string. All right, next here we want to start creative os dock. Solid creative command dock. Just say command.
[03:16] models, comments, you know, to start with id, something like primitive, new object id, okay, post, sorry, sorry, sorry, post id, post id, here we can directly pass this post id, user id,
[03:45] passing the user object ID a value value will be the speed not value where where where where yeah here we call it b not b yes exactly correct it out
[04:14] time now all right after that we want to insert this so and start by say F underscore and error command schema insert one
[04:41] ctx or contacts comment error not equal to no on that case we want to return something like c dot status fiber
[05:09] internal server error ok, hodgeso fiber.map
[05:37] I can say here error field to insert command details error dot error
[06:03] all right what next we need to start create that comment okay sorry create the notification
[06:31] convert this to... actually you need to call this ok, I just came up here Starfer is by default for user models
[06:59] user model okay then say yes error goes to user schema dot file none cdx and pso m
[07:29] where this id is equal to user's obj object id okay on that case is the code pointer of this user and then the error is equal equal if the error is equal equal no
[07:54] on that case we can create that notification where dot we need to cut all this basically
[08:18] all right this one's here we can just say hex okay goes to indian and talk to idx comment on your post i think we don't need to
[08:44] delete this. I think we need to update the notification, we will look on that later on. Or we can just do it from now.
[09:13] and just say user id and don't we have this user id yet okay just give it as it is let's save go back now we need to actually to return
[09:38] we need to return the post with live populated comments using the same function okay we just create a separate function I can call this get post what
[10:06] comments past the C and post finally alright and definitely we need to return this so I can just like this here we just build up this helper function to return post red comments
[10:35] Alright, let's just define our function. Get post.comments. Of course, we'll take this C. It shouldn't be a pointer of the fiber contacts or CTX. Okay. And the post.oi.
[11:00] the post ID actually be primitive object ID ok and this of course will return error as well alright first of all just define the post collection or post schema alright this one goes to database db
[11:30] collection posts okay next sorry i need to lower clear this next define the context and close it so what i can do is to copy this directly paste the here
[11:57] next we need to build this pipeline which will get first get the post okay so the first matchup we're looking for is the post id not just that it will return each please focus on this it will return each comment
[12:24] and the commenter data. So this might be a little bit complex, but it is actually an easy way to do it at the end. It looks like the SQL language.
[12:52] and anyway we are going to build thing or we are going to use the same way many times so you are going to understand it bit by bit by yourself ok first thing here is the match so just add dollar sign and the match chord
[13:19] or expression, let me just paste on m underscore id pasty post id this is the first thing we are looking for okay inside of this what we are look up what we are look up we can use look up
[13:48] parameters or cured and then say paste on M inside of this we want to start define what we are exactly look up first fold where we are what we are looking up from first we need to define the the collection that we're looking up from
[14:18] that collection so I'll just say from comments okay this is the first sync oh we are looking for
[14:45] here we can use i think we can use litcure to allow us to use this post id as a variable so i just say let paste on .m post id
[15:14] here we can just add this as variable alright underscore id create next after we get this id by this way this variable
[15:43] we can add or move on to the next pipeline so we need to use this pipeline cured to let Mongo driver understand how we are doing exactly so I can just say pass on
[16:10] I do need here another matching. So I use match.gorge saypeso.m
[16:33] express or regular expression person M can use also equal operator or EQ operator what should represent something like equality and can use I can just say an interface of this post
[17:01] id and we can repeat ourselves by add double sign post id all right we need to close up this one and move to the next now we can use sort operator to sort the result of this because we want to get
[17:31] the latest comments so I can just use create it up just to come back minus one all right what next and use look up
[17:59] again paste on .m this time we want to look for from another collection which will be from users
[18:28] okay just call it your id or user id sorry I need to put this on a string equal to this variable which will be user i
[18:57] please remember that this will come from the comment itself if you go to the post where is the comment where is the comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment comment
[19:25] that you need to follow where this space of m the last line expert our expression okay space of dot m
[19:52] the sign equal can use the same thing here for this user id or uid that we created okay okay I think that I missed something something is not right here after let creating we just close all this or remove all this
[20:22] we have this pipeline okay next place on PES on M okay all we can do is to match this way this way so we forget to add this match PES on M now we can use this expert operator
[20:51] so dot m no sign equal okay I want to equal for or look for this matching and our face of this we want to look for this variable
[21:20] ID alright where this match the user ID or the variable that we already created not called UID so we are inside of this creating a variable that whole hell was to understand this more or use it much simpler okay after that we can just define the project
[21:50] project.project.ok we can just say person.m what we are looking for is the username so give this one an image URL so just give it one as well cool and we can just
[22:19] came up here we'll say all this will be as user all right what next do we have okay after this symbol looking up
[22:47] we need to come up down here and we can project this user ID before that we can define the path of user resolve and add reserve null and empty arrays as well okay
[23:15] i just came up here to say area on wind peso.m path and i'll be dole sign this user here so that we need to say preserve
[23:44] preserve okay and this is the correct null and empty arrays
[24:14] and define this as true not that true okay so the idea symbol now here on on when the stage on a pipeline what we are looking for and this on this stage this will be connected to the destruction the result has an array and this
[24:41] option here that we add, preserve, null, and anti-arrange. Okay, this actually guarantees that if something is missing, if the user is not accessed anymore, anything like that, it will actually complete the operation and get the rest of the comments. Okay. After all, we can just define the project.
[25:10] I'm going to say person.m underscore ID, we care about new ID, so please grab this ID value. Also need to grab the value, create a dot.
[25:39] and user id finally the user object it's off okay and we can leave all this as comments so i just call this as
[26:08] comments okay now outside of this look up
[26:35] we need to ensure that all the fields are projected so we can come up here and check and say don't assign project okay pass on
[27:01] of course the ID Decorator okay I just duplicate this to make it much easier after the creator of the title the title the message next
[27:29] the name next the selected file next the likes and next you create it out
[27:57] finally the comments quite not great so now we can came out side of this pipeline just add in the comments
[28:21] all right now we need to use aggregate in order to make this works we can just say co-resort and error this one goes to post schema aggregate and passdoor in the contacts and our pipeline
[28:51] all right after that we can check here sorry f the error no equal to 0 okay on that case we can return c dot status fiber
[29:19] internal server error dot jesa okay fiber map error I can just say aggregation failed already something like that
[29:47] and we can add the details as well error.error okay that's cool next and finally we can why i do feel that something is not right here no everything is okay
[30:16] this was disappearing all right now we what we can do is just to close this courser so the fear courser close using the CTX of course after that we can just define the result
[30:45] you can just give it paste on m that's right next we need to check f error all give it
[31:14] and pointer of these three results if this error is not equal to new in that case we can return something similar we can just say failed to read
[31:43] aggregation result okay I think let's go all right finally we need to check if the length of this result is equal equal for example 0 on that case we can return something like this copy this is here
[32:08] I think I need to remove these pieces and change the stitch to not found okay and next sorry I didn't need to add these details at all
[32:36] just remove it just nearer can be something like post not post i'm not found okay i think not cool models sorry
[33:04] Nothing. No, we can just return the result.
[33:31] just on fiber.map just this post and this results sorry this results and we can only have the first object of that
[34:01] I think that's great now all I need to do is to test that just run our app alright just go back make sure to grab this add purr space
[34:30] close and just go to the post comment post ok, this one is here ok, I need to first look up for a post ok, let me just copy this post data sorry, post ID base dot here and the value
[34:59] first comment here anything I think let's go now just hit on execute all right look like this is promising very promising actually we have the post ID and comments inside of this comment the idea of the comment created at and user data specially user ID
[35:27] image URL this is so big down down down down next to have the name after that the user ID the value of the comment ahmadferrest comment here created that all right all the rest of the data okay just this this one more time second I can sure
[35:56] you that this will give us twice of this data yeah as you can see this time this give us on the comments array the first one move down down down down down okay and this is the value Ahmad's second comment and note that this give this to us first the second one give us at the top
[36:25] why because this is the newer comment this exactly I want to have and that's why if you remember if you go back we use this hyphen 1 because we sorted by this way we sorted the comments by this way right I think that's exactly what we want to have and everything look amazing so
[36:53] we can carry on working on it and do the same updates on all of this post controller next maybe with the notification and the user controller on the next lectures so
[37:15] See you in the next lecture.
