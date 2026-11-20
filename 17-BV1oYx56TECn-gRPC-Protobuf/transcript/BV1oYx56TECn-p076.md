[00:00] Now let's create the modify RPC for execs as well as students and for that we need to copy the modify CRUD operations from teachers CRUD. But first we need to fix one thing. We are using new model in all of the get functions in our CRUD operations and that is wrong.
[00:26] all right so this all right so this needs to be changed and that's why instead of using an external function we should use an anonymous function because that's much better so let's cut this from here
[00:53] and just remove the name that's it and now here it's going to be models.exeq
[01:19] and we are going to return and we are going to return an instance of models.exec. Let's save this and we need to do the same here. Hit ctrl space and here it will be models.student and we are going to return an instance of models.student.
[01:49] Save this and that's it. Alright now let's copy modify teachers in db.
[02:18] And I just realized that we did not refactor or delete RPC. It's not that complicated but we are going to refactor this. But let's first finish the modify function. So modify teachers in DB.
[02:44] and this is not teachers this is xx
[03:06] The next instance is lower case so that's not going to work.
[03:28] So I'm just going to do this and now
[03:57] All right
[04:24] and change this as well let's see we have one instance of teacher and let's fix that too
[04:49] Alright, so this is done. Let's save this.
[05:06] And now let's copy this into student's crud.
[05:36] you
[06:06] you
[06:12] you
[06:42] you
[07:12] all right now save this and we're done at the same time let's refactor delete teachers so
[07:32] And now I'm going to rename this to delete teachers from db Cut this from here and move this from
[07:59] teachers to teachers crud save this and we also need to fix the return types
[08:26] Alright, and let's now correct these.
[08:55] And the message will be error.error but that's not coming up because of the error. Alright let's fix this. And now we will be able to access the error message. Great.
[09:24] Save this, and here we go. Alright, so now that we are finished with the CRUD functions, let's now define the RPCs. So we need to copy update teachers.
[09:50] and bring it over here and that's it similarly here
[10:20] And that's it. Alright so now let's start the server and and here we go. So first we will check update execs and let me bring up an example message. Great.
[10:42] Alright and let's also get MongoDB Compass here and copy one of the ID. Alright and on this I'm going to change the first name to John. What's the actual name? Alright so because we are going to switch it back again later and let's also
[11:06] Change the email address. Alright, then delete the rest of the fields. Okay, that's it. So let's send the request. And here we go.
[11:34] And let's refresh our database. So now this is John Smith. Great, let's copy another ID. And this time we are going to modify two values.
[12:02] All right, first we are going to switch this one back to Alice. And this is Bob Johnson. So Bob is now John. Well, the name is going to be funny, John Johnson. So it's going to be, so this one is now going to be Barry.
[12:30] Let send the request without the comma. Format this and send. And here we go.
[12:53] Great. So our modify execs is working perfectly and update students will also work perfectly. So let's still test it. Copy this. This is John Doe. So John Doe. Let's change John Doe's class.
[13:22] instead of 10a it'll be 12a all right and for Jane Smith let's change her first name to Jenny
[13:50] And her class as well to 12A. Format this and send. Here we go. Let's refresh this, cancel and then refresh. All right, 12A, 12A and Jenny Smith, great.
[14:18] alright so now our update RPCs are also working perfectly let's now move on to delete RPC
[14:25] you
