[00:00] hello and welcome on this lecture we will continue on working on getting the posts with the comments all right let's just start from something simple we already done with career post i think we need of course to update this one as well forget to on post
[00:29] We can simply remove all this and directly return the helper function that we already created.
[00:54] okay I don't think we need this anymore I just hit save and we just run this one more time going back open this this is the post ID I just hit
[01:22] copy okay close the sub get boost tryout page is not here head on execute okay it looks fine alright now let's just go back close this
[01:50] and we didn't need to do anything over here I think we need to start work on this get all posts okay let's just check this one by one you already remember that we cannot do it by this verse
[02:15] all right um i think the first thing we need to do is to convert the following strings to objects IDs okay i just came up here say for following objects IDs also bg
[02:44] ok, id is alright, anything just have space here this will equals to primitive of this guy, ok, size of which now we can have loop for
[03:12] first I will think about it and I can name this variable followed okay this variable will equal to want to loop to the range of the user following
[03:38] remember that we put all on following so after that we can just say how b e g id error goes to primitive object id from x this is followed id
[04:02] f.error equal to 0 on that case followed objectIDs equal to append and this objectID or else
[04:26] after the slope we want to add the current user id so with a current on blend and main use of high great after that we have the limit
[04:50] now let's just create the filters let's just say filter equal to person.m creator person.m
[05:20] and following object ideas ok we want of course to get the total number of posts ok total error
[05:49] first schema count documents ctx sorry yep ctx why is that okay ctx and dependent on dot symbol filter okay
[06:15] I think that there is something going to look correct. Okay, I think we need to update this also a little bit.
[06:41] uh slice post you can just come up here say pencil m yes that's correct okay now let's just go back here and check f error not
[07:08] equal to 0. we can return c dot status fiber status not found json fiber map
[07:37] message can just say no posts all right now I think this is the point where we need to build the pipeline okay I just you know who can steal this pipeline from some places and start update that
[08:05] pipeline I think this one is cool just copy it and just go back over there and have this pipeline
[08:33] Please.
[08:52] okay right here we go
[09:21] all right we just start by the first thing which is the match that we are looking for just remove the hold on and the match that we are looking for is the creator okay so m on use an operator
[09:48] and this following object side is this is the first thing next we are looking for sorting or we want to sort the result actually so we can choose sort operator say ps on m
[10:14] underscore id minus sum next in order to generate this we can just use skip operator as well and at 64 page hyphen 1
[10:42] multiply it with the limit next we want to have the limit so as well we can use limit operator
[11:12] next we want to add first lookup user data for post creator so i can just say lookup paste on m
[11:38] and just define it on one from users local field the local field that I want to search on SD creator
[12:05] The foreign field is ID of course. Underscore ID.
[12:33] I want to look up for this as user okay now I want to add the online stage of course we need to add dollar sign this will be for the user
[13:01] I forgot to want to look up fuller documents with user data. Okay, I just look on that homebound first thing we have this from comments then let post ID exactly like this and then have
[13:30] simple pipeline first much expression equal interface post id or as post id create the sorting is correct lookup from users let uid equal to this user id
[13:59] the pipeline image URL as user unwind as comments yeah that's great but I think we need to change this a little bit first the id creator title message we have selected file
[14:27] okay we just organize this below the message give us the selected coil next give us the likes yeah and then create it add and then we need to have the comments
[14:55] sorry comments and I think we need to add user data as well so all we can do is to say user dot name user dot image URL all right that's great
[15:25] now we need to use this cursor I think we already did this some place
[15:53] I don't know where. I think that's one here. I'll just copy it. Going back here, below the webline. Okay.
[16:20] all right we have the courser, post schema, passing the pipeline, aggregation field, all right the failure, no you can come up here, check FD error equal to courser
[16:46] sorry Corrosor all ctx and make us a copy of this post pointer of this post all right save the error no equal to no on that case
[17:13] we can return see anything just return this one here error we will just say failed to decode post all right after all we want actually to proper this
[17:42] response I don't think we need to do something big deal actually I think we can just return it like this now we want to check if
[18:09] this work or not just run our app one more time going back allow where get posts get all posts page on an id for a user id copy this id for this creator
[18:36] Let's start, hit on execute, and see what will happen.
[19:00] the detail give us now I think what did it need this line here if we want this we already had it here maybe that's why this error haven't
[19:28] maybe i just test it one more time okay i just go back try to execute okay this still give us no all right i just go back okay i just take a close-up look maybe
[19:56] we have typo yep we can see this this typo here we just try to fix it this creator need to be correct okay i just hit save rerun the app one more time and now access
[20:25] go on back, hit on execute, alright it looks like this works, current bridge is on, data, hello second, this is the latest post, yep, with the user data, just like the image, to make this obvious you can just take this out for now,
[20:53] okay we can return it back later on please run this one more time yep a lot of access now hit on execute this returns to us again why maybe the ARD no this doesn't work
[21:21] just take it back anyway the main idea here is that this is what we have go down use of data we have the political Ahmad first
[21:50] yes and if you going back here you will see this ones here Ahmed 2nd and Ahmed 1st which is the oldest of course number of pages everything looks cool if you go up between yeah you will see here Ahmed 2nd comment here
[22:15] here the data that comes from the comments the images that come from the comments that related to each user all right it look like that everything is working fine everything is cool I'm not sure how we need to do an else on this lecture
[22:40] I think that's called for enough on this lecture, on the next lecture I believe that we can finally create the latest or the last route here or the new route that we want to add which is for removing a command and then we can move to the user controller and to the rest of the upgrading cooperation, alright.
[23:09] So let's just move on to the next lecture.
