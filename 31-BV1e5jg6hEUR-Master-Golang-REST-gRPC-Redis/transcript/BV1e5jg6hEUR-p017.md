[00:00] Hi and welcome from this lecture, we will start working on post endpoints. Just to start by going to our code and we need to start from models directory and start create post model. Alright for that we can simply copy this one.
[00:29] and go back and paste that here all right of course this will cause an error cause we redecler the same name on the same block this is the message yep now we need to change this to post model just change this to post model
[00:57] all right first we have the id which is primitive object id and then we have many strings after the id we have the boost creator we want to leave this as a string not primitive object id and then we have title and then we have message
[01:25] sorry sorry sorry message which will include the post message and then we can have the name we can put here the creator name and after that we have selected selected file here we can pass any image or anything like that after that we got the likes
[01:55] post likes we will have an array include users likes who like the post after likes we will have comments all right we need to change this to creator
[02:24] Just change the person as well. Change this to creator. Sorry, this is actually title. After that this will be message.
[02:53] after that this will be the name after that this will be selected file okay this one will be likes this one will be comments and that's pretty much our post model is ready
[03:22] after that nope actually I forget something very important let's just go back to the post model we want to add another field which is for create it at what should be time dot time dot record time
[03:47] all right and we can just come here and say jesso will be created out okay and person will be also created created that all right
[04:15] now we can hit save and we can say that postmodel done we need also to go to the validation we just have something like this one let us create a new file we can call it post validation.go and we can copy this one
[04:45] and paste that here all right we need to change this validator user to be validator post and this validate need to be validate post all right this one will be post modem
[05:14] the rest will be nearly the same or totally the same i think that's all we can now head save or else we need to do i just now go to main user id we need to set approach
[05:44] we need to go to the routes, post routes, user routes we need to have post routes we just start here and we can just say post routes.go
[06:11] I'll just copy this sample out paste that here change this to post remove this one we can just say get change this to post change this in a state of having os this should be post
[06:37] routes let's just say post slash any should remove all this and we can just have kind of function yep we can just return for example let's just go back here copy this one coming here
[07:07] paste out all right we do have something because we calling this and not use it we're calling this as well and not use it just take them out it's Eve now we need to go back here and say routes dot setup post routes
[07:37] pass the app to it and then hit save make sure that application running here we need now to go post any just copy this one go here after 5000 we need to put this post any
[08:01] this should return to us success through, very well everything works fine i believe that's all and i think from the next lecture we can start creating our endpoints on balance so see you on the next lecture
[08:16] Thank you.
